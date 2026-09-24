import {
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
} from './chat-config';
import {
  DEFAULT_AGENT_TRANSCRIBE_MODEL,
  EMPTY_TRANSCRIPT_MESSAGE,
  AUDIO_REQUIRED_MESSAGE,
  AUDIO_TOO_LARGE_MESSAGE,
  MAX_AGENT_TRANSCRIBE_BYTES,
  prepareAgentTranscribeRequest,
  readTranscribeResult,
  resolveAgentTranscribeModel,
  transcribeErrorMessage,
} from './voice-config';

test('resolves the Gateway transcription model from env', () => {
  expect(resolveAgentTranscribeModel({})).toBe(DEFAULT_AGENT_TRANSCRIBE_MODEL);
  expect(
    resolveAgentTranscribeModel({
      JAM_AGENT_TRANSCRIBE_MODEL: 'openai/gpt-4o-transcribe',
    }),
  ).toBe('openai/gpt-4o-transcribe');
});

test('prepareAgentTranscribeRequest validates audio, size, and gateway auth', () => {
  expect(prepareAgentTranscribeRequest(null, {})).toEqual({
    ok: false,
    status: 400,
    error: AUDIO_REQUIRED_MESSAGE,
  });
  expect(prepareAgentTranscribeRequest({ size: 0 }, {})).toMatchObject({
    ok: false,
    status: 400,
  });
  expect(
    prepareAgentTranscribeRequest(
      { size: MAX_AGENT_TRANSCRIBE_BYTES + 1 },
      { AI_GATEWAY_API_KEY: 'key' },
    ),
  ).toEqual({
    ok: false,
    status: 413,
    error: AUDIO_TOO_LARGE_MESSAGE,
  });
  expect(prepareAgentTranscribeRequest({ size: 12 }, {})).toEqual({
    ok: false,
    status: 503,
    error: GATEWAY_UNAVAILABLE_MESSAGE,
  });
  expect(
    prepareAgentTranscribeRequest({ size: 12 }, { AI_GATEWAY_API_KEY: 'key' }),
  ).toEqual({
    ok: true,
    model: DEFAULT_AGENT_TRANSCRIBE_MODEL,
  });
});

test('transcribeErrorMessage maps empty transcripts and missing keys', () => {
  expect(transcribeErrorMessage(new Error('No transcript generated.'))).toBe(
    EMPTY_TRANSCRIPT_MESSAGE,
  );
  expect(transcribeErrorMessage(new Error('Missing AI_GATEWAY_API_KEY'))).toBe(
    GATEWAY_UNAVAILABLE_MESSAGE,
  );
});

test('readTranscribeResult parses success and error JSON', () => {
  expect(readTranscribeResult({ text: '  Show B major.  ' }, true, '')).toEqual(
    {
      ok: true,
      text: 'Show B major.',
    },
  );
  expect(
    readTranscribeResult(
      { error: 'No speech detected. Try again.' },
      false,
      '',
    ),
  ).toEqual({
    ok: false,
    error: 'No speech detected. Try again.',
  });
  expect(readTranscribeResult({ text: '   ' }, true, '')).toEqual({
    ok: false,
    error: EMPTY_TRANSCRIPT_MESSAGE,
  });
});

test('transcribeErrorMessage asks to replace a rejected Gateway key', () => {
  expect(
    transcribeErrorMessage(
      new Error('AI Gateway authentication failed: Invalid API key or token.'),
    ),
  ).toBe(GATEWAY_KEY_REJECTED_MESSAGE);
});
