import {
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
  hasAiGatewayCredentials,
  isGatewayKeyRejected,
} from './chat-config';

export { GATEWAY_UNAVAILABLE_MESSAGE };

export const DEFAULT_AGENT_TRANSCRIBE_MODEL = 'openai/whisper-1';
export const MAX_AGENT_TRANSCRIBE_BYTES = 8 * 1024 * 1024;
export const MAX_VOICE_RECORDING_MS = 60_000;

export const AUDIO_REQUIRED_MESSAGE =
  'Voice request must include an audio recording.';
export const AUDIO_TOO_LARGE_MESSAGE =
  'Recording is too long. Try a shorter clip.';
export const EMPTY_TRANSCRIPT_MESSAGE = 'No speech detected. Try again.';
export const TRANSCRIBE_FAILED_MESSAGE =
  'Could not transcribe that recording. Try again.';
export const VOICE_UNSUPPORTED_MESSAGE =
  'Voice input is not supported in this browser.';

type Env = Record<string, string | undefined>;

export function resolveAgentTranscribeModel(env: Env = process.env) {
  return (
    env.JAM_AGENT_TRANSCRIBE_MODEL?.trim() || DEFAULT_AGENT_TRANSCRIBE_MODEL
  );
}

export function prepareAgentTranscribeRequest(
  audio: { size: number } | null | undefined,
  env: Env = process.env,
) {
  if (!audio || audio.size <= 0) {
    return {
      ok: false as const,
      status: 400,
      error: AUDIO_REQUIRED_MESSAGE,
    };
  }
  if (audio.size > MAX_AGENT_TRANSCRIBE_BYTES) {
    return {
      ok: false as const,
      status: 413,
      error: AUDIO_TOO_LARGE_MESSAGE,
    };
  }
  if (!hasAiGatewayCredentials(env)) {
    return {
      ok: false as const,
      status: 503,
      error: GATEWAY_UNAVAILABLE_MESSAGE,
    };
  }
  return {
    ok: true as const,
    model: resolveAgentTranscribeModel(env),
  };
}

export function transcribeErrorMessage(error: unknown) {
  const text =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : String(error ?? '');
  if (/no transcript generated/i.test(text)) {
    return EMPTY_TRANSCRIPT_MESSAGE;
  }
  if (isGatewayKeyRejected(error)) return GATEWAY_KEY_REJECTED_MESSAGE;
  if (
    /AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|unauthorized|401|403|api key|gateway/i.test(
      text,
    )
  ) {
    return GATEWAY_UNAVAILABLE_MESSAGE;
  }
  return text || TRANSCRIBE_FAILED_MESSAGE;
}

export function readTranscribeResult(body: unknown, ok: boolean, raw: string) {
  if (
    body &&
    typeof body === 'object' &&
    'text' in body &&
    typeof (body as { text: unknown }).text === 'string'
  ) {
    const text = (body as { text: string }).text.trim();
    if (ok && text) return { ok: true as const, text };
  }
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return {
      ok: false as const,
      error:
        (body as { error: string }).error.trim() || TRANSCRIBE_FAILED_MESSAGE,
    };
  }
  if (!ok) {
    return {
      ok: false as const,
      error: raw.trim() || TRANSCRIBE_FAILED_MESSAGE,
    };
  }
  return { ok: false as const, error: EMPTY_TRANSCRIPT_MESSAGE };
}
