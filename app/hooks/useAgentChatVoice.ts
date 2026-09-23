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
import { MAX_VOICE_RECORDING_MS } from '~/agent/voice-config';

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
  onStopAndSend: () => void;
  onCancel: () => void;
  onRefreshDevices: () => void;
};

type Session = {
  stream: MediaStream;
  recorder: MediaRecorder;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  raf: number | null;
  chunks: BlobPart[];
};

function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach(track => track.stop());
}

export function useAgentChatVoice({
  enabled = true,
  onTranscript,
}: {
  enabled?: boolean;
  onTranscript: (text: string) => void;
}): AgentChatVoice {
  const supported = isVoiceInputSupported();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<VoiceDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(
    () => loadVoiceDeviceId(),
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [level, setLevel] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const generationRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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

  const teardownSession = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) {
      setLevel(0);
      return;
    }
    if (session.raf !== null) {
      cancelAnimationFrame(session.raf);
    }
    try {
      session.source.disconnect();
    } catch {
      // Already disconnected.
    }
    void session.context.close();
    if (session.recorder.state !== 'inactive') {
      try {
        session.recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }
    stopTracks(session.stream);
    setLevel(0);
  }, []);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    teardownSession();
    setStatus('idle');
  }, [teardownSession]);

  const startMeter = useCallback((session: Session) => {
    const buffer = new Float32Array(session.analyser.fftSize);
    const tick = () => {
      if (sessionRef.current !== session) return;
      session.analyser.getFloatTimeDomainData(buffer);
      setLevel(Math.min(1, rmsLevel(buffer) * 4));
      session.raf = requestAnimationFrame(tick);
    };
    session.raf = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (!supported || !enabled) return;
    if (
      status === 'requesting' ||
      status === 'recording' ||
      status === 'transcribing'
    ) {
      return;
    }
    generationRef.current += 1;
    const generation = generationRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    teardownSession();
    setError(null);
    setStatus('requesting');

    try {
      const stream = await createVoiceInputStream(selectedDeviceId);
      if (generation !== generationRef.current) {
        stopTracks(stream);
        return;
      }

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const session: Session = {
        stream,
        recorder,
        context,
        source,
        analyser,
        raf: null,
        chunks: [],
      };
      recorder.ondataavailable = event => {
        if (event.data.size > 0) session.chunks.push(event.data);
      };
      sessionRef.current = session;
      recorder.start();
      startMeter(session);

      const actualId = trackDeviceId(stream);
      if (actualId) setSelectedDeviceId(actualId);
      setHasPermission(true);
      void refreshDevices();
      setStatus('recording');

      timeoutRef.current = window.setTimeout(() => {
        if (generationRef.current === generation) {
          void stopAndSendRef.current();
        }
      }, MAX_VOICE_RECORDING_MS);
    } catch (err) {
      stopTracks(sessionRef.current?.stream);
      teardownSession();
      setError(mapVoiceMicError(err));
      setStatus('error');
    }
  }, [
    enabled,
    refreshDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    startMeter,
    status,
    supported,
    teardownSession,
  ]);

  const stopAndSend = useCallback(async () => {
    const session = sessionRef.current;
    const generation = generationRef.current;
    if (!session || status !== 'recording') return;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (session.raf !== null) {
      cancelAnimationFrame(session.raf);
      session.raf = null;
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      session.recorder.onerror = () =>
        reject(new Error('Recording failed. Try again.'));
      session.recorder.onstop = () => {
        resolve(
          new Blob(session.chunks, {
            type: session.recorder.mimeType || 'audio/webm',
          }),
        );
      };
      try {
        session.recorder.stop();
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Recording failed. Try again.'),
        );
      }
    });

    try {
      session.source.disconnect();
    } catch {
      // Already disconnected.
    }
    void session.context.close();
    stopTracks(session.stream);
    if (sessionRef.current === session) sessionRef.current = null;
    setLevel(0);

    if (generation !== generationRef.current) return;

    setStatus('transcribing');
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const text = await transcribeVoiceRecording(blob, abort.signal);
      if (generation !== generationRef.current) return;
      setStatus('idle');
      setError(null);
      onTranscriptRef.current(text);
    } catch (err) {
      if (abort.signal.aborted || generation !== generationRef.current) return;
      setError(mapVoiceMicError(err));
      setStatus('error');
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [status]);

  stopAndSendRef.current = stopAndSend;

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

  useEffect(() => () => cancel(), [cancel]);

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
    onStopAndSend: () => {
      void stopAndSend();
    },
    onCancel: cancel,
    onRefreshDevices: () => {
      void refreshDevices();
    },
  };
}
