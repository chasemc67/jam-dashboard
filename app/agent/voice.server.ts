import { transcribe } from 'ai';
import {
  AUDIO_REQUIRED_MESSAGE,
  EMPTY_TRANSCRIPT_MESSAGE,
  prepareAgentTranscribeRequest,
  transcribeErrorMessage,
} from './voice-config';

type TranscribeAudio = (args: {
  model: string;
  audio: Uint8Array;
  abortSignal?: AbortSignal;
}) => Promise<{ text: string }>;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isAudioBlob(value: unknown): value is Blob {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number'
  );
}

export async function handleAgentTranscribeRequest(
  request: Request,
  deps: {
    transcribeAudio?: TranscribeAudio;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(AUDIO_REQUIRED_MESSAGE, 400);
  }

  const audio = form.get('audio');
  if (!isAudioBlob(audio)) {
    return jsonError(AUDIO_REQUIRED_MESSAGE, 400);
  }

  const env = deps.env ?? process.env;
  const prepared = prepareAgentTranscribeRequest({ size: audio.size }, env);
  if (!prepared.ok) {
    return jsonError(prepared.error, prepared.status);
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const transcribeAudio =
    deps.transcribeAudio ??
    (args =>
      transcribe({
        model: args.model,
        audio: args.audio,
        abortSignal: args.abortSignal,
      }));

  try {
    const result = await transcribeAudio({
      model: prepared.model,
      audio: bytes,
      abortSignal: request.signal,
    });
    const text = result.text?.trim() ?? '';
    if (!text) {
      return jsonError(EMPTY_TRANSCRIPT_MESSAGE, 422);
    }
    return Response.json({ text });
  } catch (error) {
    const message = transcribeErrorMessage(error);
    const status = message === EMPTY_TRANSCRIPT_MESSAGE ? 422 : 503;
    return jsonError(message, status);
  }
}
