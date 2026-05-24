import { useState, useCallback, useRef, useEffect } from 'react';
import {
  listInputDevices,
  createInputStream,
  createAnalyserPipeline,
  type AnalyserPipeline,
} from '~/utils/audioInput';
import {
  detectPitch,
  frequencyToNoteName,
  isLikelyGuitarRange,
} from '~/utils/pitchDetection';

export type DetectionStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'error';

const CLARITY_THRESHOLD = 0.9;
const CONSECUTIVE_FRAMES_REQUIRED = 3;

export interface UseNoteDetectionReturn {
  status: DetectionStatus;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  currentNote: string | null;
  noteLog: string[];
  start: () => Promise<void>;
  stop: () => void;
  clearLog: () => void;
  refreshDevices: () => Promise<void>;
}

export function useNoteDetection(): UseNoteDetectionReturn {
  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [noteLog, setNoteLog] = useState<string[]>([]);

  const pipelineRef = useRef<AnalyserPipeline | null>(null);
  const rafRef = useRef<number | null>(null);
  const consecutiveRef = useRef<{ note: string; count: number }>({
    note: '',
    count: 0,
  });
  const lastCommittedRef = useRef<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const devs = await listInputDevices();
      setDevices(devs);
    } catch {
      setDevices([]);
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pipelineRef.current) {
      pipelineRef.current.cleanup();
      pipelineRef.current = null;
    }
    setStatus('idle');
    setCurrentNote(null);
    consecutiveRef.current = { note: '', count: 0 };
    lastCommittedRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    setStatus('requesting');

    try {
      const stream = await createInputStream(selectedDeviceId ?? undefined);
      const pipeline = createAnalyserPipeline(stream);
      pipelineRef.current = pipeline;

      await refreshDevices();

      setStatus('listening');

      const buffer = new Float32Array(pipeline.analyser.fftSize);

      const tick = () => {
        if (!pipelineRef.current) return;

        pipeline.analyser.getFloatTimeDomainData(buffer);
        const result = detectPitch(buffer, pipeline.context.sampleRate);

        if (
          result.frequency !== null &&
          result.clarity >= CLARITY_THRESHOLD &&
          isLikelyGuitarRange(result.frequency)
        ) {
          const note = frequencyToNoteName(result.frequency);
          if (note) {
            if (note === consecutiveRef.current.note) {
              consecutiveRef.current.count++;
            } else {
              consecutiveRef.current = { note, count: 1 };
            }

            if (
              consecutiveRef.current.count >= CONSECUTIVE_FRAMES_REQUIRED &&
              note !== lastCommittedRef.current
            ) {
              lastCommittedRef.current = note;
              setCurrentNote(note);
              setNoteLog((prev) => [...prev, note]);
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : err instanceof Error
            ? err.message
            : 'Failed to access audio input';
      setError(message);
      setStatus('error');
    }
  }, [selectedDeviceId, stop, refreshDevices]);

  const clearLog = useCallback(() => {
    setNoteLog([]);
    setCurrentNote(null);
    lastCommittedRef.current = null;
    consecutiveRef.current = { note: '', count: 0 };
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (pipelineRef.current) pipelineRef.current.cleanup();
    };
  }, []);

  return {
    status,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    currentNote,
    noteLog,
    start,
    stop,
    clearLog,
    refreshDevices,
  };
}
