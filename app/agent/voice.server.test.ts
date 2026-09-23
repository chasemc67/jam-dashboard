/**
 * @jest-environment node
 */
jest.mock('ai', () => ({
  transcribe: jest.fn(),
}));

import { handleAgentTranscribeRequest } from './voice.server';
import {
  AUDIO_REQUIRED_MESSAGE,
  EMPTY_TRANSCRIPT_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
} from './voice-config';

function requestWithAudio(file: File | null) {
  return {
    signal: new AbortController().signal,
    formData: async () => {
      const form = new FormData();
      if (file) form.append('audio', file);
      return form;
    },
  } as Request;
}

const audio = () =>
  new File([new Uint8Array([1, 2, 3, 4])], 'voice.webm', {
    type: 'audio/webm',
  });

test('rejects missing audio and missing gateway credentials', async () => {
  const missing = await handleAgentTranscribeRequest(requestWithAudio(null), {
    env: { AI_GATEWAY_API_KEY: 'key' },
  });
  expect(missing.status).toBe(400);
  await expect(missing.json()).resolves.toEqual({
    error: AUDIO_REQUIRED_MESSAGE,
  });

  const noKey = await handleAgentTranscribeRequest(requestWithAudio(audio()), {
    env: {},
  });
  expect(noKey.status).toBe(503);
  await expect(noKey.json()).resolves.toEqual({
    error: GATEWAY_UNAVAILABLE_MESSAGE,
  });
});

test('transcribes audio through the injected Gateway STT function', async () => {
  const transcribeAudio = jest.fn(async ({ model, audio: bytes }) => {
    expect(model).toBe('openai/gpt-4o-mini-transcribe');
    expect(bytes.byteLength).toBe(4);
    return { text: '  Show D dorian.  ' };
  });
  const response = await handleAgentTranscribeRequest(
    requestWithAudio(audio()),
    {
      transcribeAudio,
      env: {
        AI_GATEWAY_API_KEY: 'key',
        JAM_AGENT_TRANSCRIBE_MODEL: 'openai/gpt-4o-mini-transcribe',
      },
    },
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ text: 'Show D dorian.' });
  expect(transcribeAudio).toHaveBeenCalledTimes(1);
});

test('returns 422 when the model produces an empty transcript', async () => {
  const response = await handleAgentTranscribeRequest(
    requestWithAudio(audio()),
    {
      transcribeAudio: async () => ({ text: '   ' }),
      env: { AI_GATEWAY_API_KEY: 'key' },
    },
  );
  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toEqual({
    error: EMPTY_TRANSCRIPT_MESSAGE,
  });
});
