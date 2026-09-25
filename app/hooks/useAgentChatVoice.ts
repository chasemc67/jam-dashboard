import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceInputStream,
  isVoiceInputSupported,
  listVoiceInputDevices,
  loadVoiceDeviceId,
  mapVoiceMicError,
  pickRecorderMimeType,
  rmsLevel,
  saveVoiceDeviceId,
  trackDeviceId,
  transcribeVoiceRecording,
  type VoiceDeviceOption,
  type VoiceStatus,
} from '~/agent/voice-mic';
import {
  EMPTY_TRANSCRIPT_MESSAGE,
  MAX_VOICE_RECORDING_MS,
} from '~/agent/voice-config';
import {
  appendDictation,
  DictationTranscript,
  shouldRequestInterim,
  shouldRotateSegment,
  VOICE_SPEECH_RMS,
  VOICE_TICK_MS,
  VOICE_TIMESLICE_MS,
} from '~/agent/voice-dictation';

export type AgentChatVoice = {
  status: VoiceStatus;
  error: string | null;
  devices: VoiceDeviceOption[];
  selectedDeviceId: string | null;
  hasPermission: boolean;
  level: number;
  supported: boolean;
  onSelectDevice: (deviceId: string) => void;
  onStart: () => void;
  /**
   * Stops dictation and finishes transcribing. Never sends; resolves with the
   * final composer draft, or null if nothing was being dictated.
   */
  onStop: () => Promise<string | null>;
  /** Stops dictation and restores the draft from before the mic started. */
  onCancel: () => void;
  onRefreshDevices: () => void;
};

type Segment = {
  index: number;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  heardSpeech: boolean;
  interimChunkCount: number;
};

type Session = {
  generation: number;
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Float32Array;
  raf: number | null;
  tick: number | null;
  mimeType: string;
  segment: Segment;
  nextSegment: number;
  silentSince: number | null;
  anySpeech: boolean;
  lastInterimAt: number;
  interimSeq: number;
  interimAbort: AbortController | null;
  finalAbort: AbortController;
  pendingFinals: Set<Promise<void>>;
  transcript: DictationTranscript;
  baseDraft: string;
  lastError: string | null;
};

function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach(track => track.stop());
}

function stopRecorder(recorder: MediaRecorder, chunks: Blob[], type: string) {
  return new Promise<Blob>(resolve => {
    const done = () => resolve(new Blob(chunks, { type }));
    if (recorder.state === 'inactive') {
      done();
      return;
    }
    recorder.onstop = done;
    recorder.onerror = done;
    try {
      recorder.stop();
    } catch {
      done();
    }
  });
}

export function useAgentChatVoice({
  enabled = true,
  draft,
  onDraftChange,
}: {
  enabled?: boolean;
  /** Current composer text; dictation appends to it. */
  draft: string;
  onDraftChange: (draft: string) => void;
}): AgentChatVoice {
  const supported = isVoiceInputSupported();
  const [status, setStatusState] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<VoiceDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(
    () => loadVoiceDeviceId(),
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [level, setLevel] = useState(0);

  const statusRef = useRef<VoiceStatus>('idle');
  const sessionRef = useRef<Session | null>(null);
  const generationRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const stopPromiseRef = useRef<Promise<string | null> | null>(null);
  const stopRef = useRef<() => Promise<string | null>>(async () => null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  const setStatus = useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const setSelectedDeviceId = useCallback((deviceId: string | null) => {
    setSelectedDeviceIdState(deviceId);
    saveVoiceDeviceId(deviceId);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const listed = await listVoiceInputDevices();
      setHasPermission(listed.granted || listed.devices.length > 0);
      setDevices(listed.devices);
      const saved = loadVoiceDeviceId();
      if (saved && listed.devices.some(device => device.deviceId === saved)) {
        setSelectedDeviceIdState(saved);
      }
    } catch {
      setDevices([]);
    }
  }, []);

  const publish = useCallback((session: Session) => {
    if (session.generation !== generationRef.current) return;
    onDraftChangeRef.current(
      appendDictation(session.baseDraft, session.transcript.text()),
    );
  }, []);

  const releaseAudio = useCallback((session: Session) => {
    if (session.raf !== null) cancelAnimationFrame(session.raf);
    session.raf = null;
    if (session.tick !== null) window.clearInterval(session.tick);
    session.tick = null;
    try {
      session.source.disconnect();
    } catch {
      // Already disconnected.
    }
    void session.context.close();
    stopTracks(session.stream);
    setLevel(0);
  }, []);

  const teardownSession = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    stopPromiseRef.current = null;
    if (!session) {
      setLevel(0);
      return null;
    }
    session.interimAbort?.abort();
    session.finalAbort.abort();
    const { recorder } = session.segment;
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }
    releaseAudio(session);
    return session;
  }, [releaseAudio]);

  const cancelSession = useCallback(
    (restoreDraft: boolean) => {
      generationRef.current += 1;
      const session = teardownSession();
      if (restoreDraft && session) onDraftChangeRef.current(session.baseDraft);
      setStatus('idle');
    },
    [setStatus, teardownSession],
  );

  const startSegment = useCallback((session: Session): Segment => {
    const recorder = session.mimeType
      ? new MediaRecorder(session.stream, { mimeType: session.mimeType })
      : new MediaRecorder(session.stream);
    const segment: Segment = {
      index: session.nextSegment,
      recorder,
      chunks: [],
      startedAt: Date.now(),
      heardSpeech: false,
      interimChunkCount: 0,
    };
    session.nextSegment += 1;
    recorder.ondataavailable = event => {
      if (event.data.size > 0) segment.chunks.push(event.data);
    };
    recorder.start(VOICE_TIMESLICE_MS);
    return segment;
  }, []);

  const blobType = (session: Session, segment: Segment) =>
    segment.recorder.mimeType || session.mimeType || 'audio/webm';

  /** Stops `segment` and records its final transcription on the session. */
  const finalizeSegment = useCallback(
    (session: Session, segment: Segment, force = false) => {
      const task = (async () => {
        const blob = await stopRecorder(
          segment.recorder,
          segment.chunks,
          blobType(session, segment),
        );
        if (!segment.heardSpeech && !force) {
          session.transcript.setFinal(segment.index, '');
          return;
        }
        try {
          const text = await transcribeVoiceRecording(
            blob,
            session.finalAbort.signal,
          );
          session.transcript.setFinal(segment.index, text);
        } catch (err) {
          if (session.finalAbort.signal.aborted) return;
          const message = mapVoiceMicError(err);
          // Keep the interim so a failed final doesn't delete visible words.
          session.transcript.setFinal(
            segment.index,
            session.transcript.interimText(segment.index),
          );
          if (message !== EMPTY_TRANSCRIPT_MESSAGE) session.lastError = message;
        }
        publish(session);
      })();
      session.pendingFinals.add(task);
      void task.finally(() => session.pendingFinals.delete(task));
      return task;
    },
    [publish],
  );

  const requestInterim = useCallback(
    (session: Session, segment: Segment) => {
      session.interimSeq += 1;
      const seq = session.interimSeq;
      segment.interimChunkCount = segment.chunks.length;
      session.lastInterimAt = Date.now();
      const abort = new AbortController();
      session.interimAbort = abort;
      const blob = new Blob(segment.chunks, {
        type: blobType(session, segment),
      });
      void transcribeVoiceRecording(blob, abort.signal)
        .then(text => {
          if (session.transcript.setInterim(segment.index, seq, text)) {
            publish(session);
          }
        })
        .catch(() => {
          // Interims are best-effort; the segment's final result decides.
        })
        .finally(() => {
          if (session.interimAbort === abort) session.interimAbort = null;
        });
    },
    [publish],
  );

  const tick = useCallback(
    (session: Session) => {
      if (sessionRef.current !== session || statusRef.current !== 'recording') {
        return;
      }
      const now = Date.now();
      session.analyser.getFloatTimeDomainData(session.samples);
      const segment = session.segment;
      if (rmsLevel(session.samples) >= VOICE_SPEECH_RMS) {
        segment.heardSpeech = true;
        session.anySpeech = true;
        session.silentSince = null;
      } else if (session.silentSince === null) {
        session.silentSince = now;
      }

      if (
        shouldRotateSegment({
          segmentMs: now - segment.startedAt,
          silentMs:
            session.silentSince === null ? 0 : now - session.silentSince,
          heardSpeech: segment.heardSpeech,
        })
      ) {
        session.segment = startSegment(session);
        void finalizeSegment(session, segment);
        return;
      }

      if (
        shouldRequestInterim({
          sinceLastMs: now - session.lastInterimAt,
          inFlight: session.interimAbort !== null,
          hasNewAudio: segment.chunks.length > segment.interimChunkCount,
          heardSpeech: segment.heardSpeech,
        })
      ) {
        requestInterim(session, segment);
      }
    },
    [finalizeSegment, requestInterim, startSegment],
  );

  const startMeter = useCallback((session: Session) => {
    const buffer = new Float32Array(session.analyser.fftSize);
    const frame = () => {
      if (sessionRef.current !== session) return;
      session.analyser.getFloatTimeDomainData(buffer);
      setLevel(Math.min(1, rmsLevel(buffer) * 4));
      session.raf = requestAnimationFrame(frame);
    };
    session.raf = requestAnimationFrame(frame);
  }, []);

  const start = useCallback(async () => {
    if (!supported || !enabled) return;
    const current = statusRef.current;
    if (
      current === 'requesting' ||
      current === 'recording' ||
      current === 'transcribing'
    ) {
      return;
    }
    generationRef.current += 1;
    const generation = generationRef.current;
    teardownSession();
    setError(null);
    setStatus('requesting');

    let stream: MediaStream | null = null;
    try {
      stream = await createVoiceInputStream(selectedDeviceId);
      if (generation !== generationRef.current) {
        stopTracks(stream);
        return;
      }

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const session = {
        generation,
        stream,
        context,
        source,
        analyser,
        samples: new Float32Array(analyser.fftSize),
        raf: null,
        tick: null,
        mimeType: pickRecorderMimeType(),
        nextSegment: 0,
        silentSince: null,
        anySpeech: false,
        lastInterimAt: Date.now(),
        interimSeq: 0,
        interimAbort: null,
        finalAbort: new AbortController(),
        pendingFinals: new Set(),
        transcript: new DictationTranscript(),
        baseDraft: draftRef.current,
        lastError: null,
      } as Omit<Session, 'segment'> as Session;
      session.segment = startSegment(session);
      sessionRef.current = session;
      startMeter(session);
      session.tick = window.setInterval(() => tick(session), VOICE_TICK_MS);

      const actualId = trackDeviceId(stream);
      if (actualId) setSelectedDeviceId(actualId);
      setHasPermission(true);
      void refreshDevices();
      setStatus('recording');

      timeoutRef.current = window.setTimeout(() => {
        if (generationRef.current === generation) void stopRef.current();
      }, MAX_VOICE_RECORDING_MS);
    } catch (err) {
      stopTracks(stream);
      teardownSession();
      setError(mapVoiceMicError(err));
      setStatus('error');
    }
  }, [
    enabled,
    refreshDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    setStatus,
    startMeter,
    startSegment,
    supported,
    teardownSession,
    tick,
  ]);

  const stop = useCallback((): Promise<string | null> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const session = sessionRef.current;
    if (!session || statusRef.current !== 'recording') {
      return Promise.resolve(null);
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus('transcribing');

    const promise = (async () => {
      if (session.tick !== null) window.clearInterval(session.tick);
      session.tick = null;
      session.interimAbort?.abort();
      // With no speech detected anywhere, still transcribe once in case the
      // input is just quiet; otherwise silent tails are dropped to avoid STT
      // hallucinating on silence.
      void finalizeSegment(session, session.segment, !session.anySpeech);
      releaseAudio(session);
      while (session.pendingFinals.size > 0) {
        await Promise.allSettled([...session.pendingFinals]);
      }
      if (session.generation !== generationRef.current) return null;

      const text = session.transcript.text();
      const finalDraft = appendDictation(session.baseDraft, text);
      onDraftChangeRef.current(finalDraft);
      sessionRef.current = null;
      stopPromiseRef.current = null;
      const message = text
        ? session.lastError
        : (session.lastError ?? EMPTY_TRANSCRIPT_MESSAGE);
      setError(message);
      setStatus(message ? 'error' : 'idle');
      return finalDraft;
    })();
    stopPromiseRef.current = promise;
    return promise;
  }, [finalizeSegment, releaseAudio, setStatus]);

  stopRef.current = stop;

  useEffect(() => {
    void refreshDevices();
    const onDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        onDeviceChange,
      );
    };
  }, [refreshDevices]);

  useEffect(() => () => cancelSession(false), [cancelSession]);

  return {
    status,
    error,
    devices,
    selectedDeviceId,
    hasPermission,
    level,
    supported,
    onSelectDevice: deviceId => setSelectedDeviceId(deviceId),
    onStart: () => {
      void start();
    },
    onStop: stop,
    onCancel: () => cancelSession(true),
    onRefreshDevices: () => {
      void refreshDevices();
    },
  };
}
