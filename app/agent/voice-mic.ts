import { checkMicPermission, listInputDevices } from '~/utils/audioInput';
import { DESKTOP_AGENT_REQUEST_HEADER } from './gateway-key';
import {
  EMPTY_TRANSCRIPT_MESSAGE,
  readTranscribeResult,
  TRANSCRIBE_FAILED_MESSAGE,
} from './voice-config';

/**
 * Independent of Note Detector / guitar capture (`createInputStream` in
 * `audioInput.ts`, which turns echo cancellation and related DSP off and does
 * not persist a device id).
 *
 * Chat voice opens a second `getUserMedia({ audio: { deviceId: { exact } } })`
 * stream with speech processing on. Two different physical devices can run at
 * once (guitar on one input, speech on another). Opening the *same* device
 * twice is flaky in many browsers (`NotReadableError`, silence, or a shared
 * muted track).
 */
export const AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY =
  'jam-agent-chat-voice-device-id';

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export type VoiceStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'transcribing'
  | 'error';

export type VoiceDeviceOption = {
  deviceId: string;
  label: string;
};

export function loadVoiceDeviceId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY);
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveVoiceDeviceId(deviceId: string | null) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!deviceId) {
      localStorage.removeItem(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    // Private mode may block persistence; recording still works.
  }
}

export function voiceStreamConstraints(
  deviceId?: string | null,
): MediaStreamConstraints {
  return {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  };
}

export async function createVoiceInputStream(
  deviceId?: string | null,
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(
      voiceStreamConstraints(deviceId),
    );
  } catch (error) {
    if (deviceId && isOverconstrained(error)) {
      return navigator.mediaDevices.getUserMedia(voiceStreamConstraints(null));
    }
    throw error;
  }
}

export function pickRecorderMimeType(
  isSupported: (type: string) => boolean = type =>
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(type),
) {
  return RECORDER_MIME_CANDIDATES.find(type => isSupported(type)) ?? '';
}

export function voiceAudioFilename(mediaType: string) {
  if (mediaType.includes('mp4')) return 'voice.mp4';
  if (mediaType.includes('ogg')) return 'voice.ogg';
  return 'voice.webm';
}

export function mapVoiceMicError(error: unknown) {
  if (error instanceof DOMException || error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone permission denied. Allow access in the browser to use voice mode.';
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone found. Plug in a mic or pick another device.';
    }
    if (error.name === 'NotReadableError') {
      return 'That microphone is busy. Pick a different device from Note Detector, or stop the other app using it.';
    }
    if (error.name === 'OverconstrainedError') {
      return 'The saved chat microphone is unavailable. Choose another input.';
    }
    if (error.message.trim()) return error.message.trim();
  }
  return 'Could not open the chat microphone.';
}

export function rmsLevel(samples: ArrayLike<number>) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export function isVoiceInputSupported() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export async function listVoiceInputDevices() {
  const granted = await checkMicPermission();
  const devices = await listInputDevices();
  return {
    granted,
    devices: devices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${index + 1}`,
    })),
  };
}

export function trackDeviceId(stream: MediaStream) {
  const id = stream.getAudioTracks()[0]?.getSettings().deviceId;
  return id?.trim() ? id : null;
}

export async function transcribeVoiceRecording(
  blob: Blob,
  signal?: AbortSignal,
) {
  if (blob.size <= 0) {
    throw new Error(EMPTY_TRANSCRIPT_MESSAGE);
  }
  const form = new FormData();
  form.append('audio', blob, voiceAudioFilename(blob.type || 'audio/webm'));
  const response = await fetch('/api/agent-transcribe', {
    method: 'POST',
    headers: { [DESKTOP_AGENT_REQUEST_HEADER]: '1' },
    body: form,
    signal,
  });
  const raw = await response.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Non-JSON error bodies still surface via readTranscribeResult.
  }
  const result = readTranscribeResult(parsed, response.ok, raw);
  if (!result.ok) {
    throw new Error(result.error || TRANSCRIBE_FAILED_MESSAGE);
  }
  return result.text;
}

function isOverconstrained(error: unknown) {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === 'OverconstrainedError'
  );
}
