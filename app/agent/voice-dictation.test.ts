import {
  appendDictation,
  DictationTranscript,
  shouldRequestInterim,
  shouldRotateSegment,
  VOICE_INTERIM_INTERVAL_MS,
  VOICE_SEGMENT_MAX_MS,
  VOICE_SEGMENT_MIN_MS,
  VOICE_SILENCE_ROTATE_MS,
} from './voice-dictation';

describe('appendDictation', () => {
  test('fills an empty composer', () => {
    expect(appendDictation('', 'Show B major')).toBe('Show B major');
    expect(appendDictation('   ', ' Show B major ')).toBe('Show B major');
  });

  test('appends to an existing draft with a single space', () => {
    expect(appendDictation('Show me', 'B major')).toBe('Show me B major');
    expect(appendDictation('Show me ', 'B major')).toBe('Show me B major');
    expect(appendDictation('Line one\n', 'line two')).toBe(
      'Line one\nline two',
    );
  });

  test('leaves the draft untouched when there is no transcript', () => {
    expect(appendDictation('Show me', '')).toBe('Show me');
    expect(appendDictation('Show me ', '  ')).toBe('Show me ');
  });
});

describe('DictationTranscript', () => {
  test('joins segments in order even when results arrive out of order', () => {
    const transcript = new DictationTranscript();
    transcript.setFinal(1, 'then highlight the third');
    transcript.setFinal(0, 'Show B major');
    expect(transcript.text()).toBe('Show B major then highlight the third');
  });

  test('shows the latest interim until the segment is final', () => {
    const transcript = new DictationTranscript();
    transcript.setFinal(0, 'Show B major');
    expect(transcript.setInterim(1, 2, 'then high')).toBe(true);
    expect(transcript.setInterim(1, 1, 'then')).toBe(false);
    expect(transcript.text()).toBe('Show B major then high');
    transcript.setFinal(1, 'then highlight');
    expect(transcript.setInterim(1, 3, 'stale')).toBe(false);
    expect(transcript.text()).toBe('Show B major then highlight');
  });

  test('empty segments add no extra spaces', () => {
    const transcript = new DictationTranscript();
    transcript.setFinal(0, 'Show');
    transcript.setFinal(1, '');
    transcript.setFinal(2, 'B major');
    expect(transcript.text()).toBe('Show B major');
  });
});

test('rotates segments at a pause after speech, or at the hard cap', () => {
  const base = { heardSpeech: true, silentMs: VOICE_SILENCE_ROTATE_MS };
  expect(
    shouldRotateSegment({ ...base, segmentMs: VOICE_SEGMENT_MIN_MS }),
  ).toBe(true);
  expect(
    shouldRotateSegment({ ...base, segmentMs: VOICE_SEGMENT_MIN_MS - 1 }),
  ).toBe(false);
  expect(
    shouldRotateSegment({
      ...base,
      silentMs: 0,
      segmentMs: VOICE_SEGMENT_MIN_MS,
    }),
  ).toBe(false);
  expect(
    shouldRotateSegment({
      ...base,
      heardSpeech: false,
      segmentMs: VOICE_SEGMENT_MIN_MS,
    }),
  ).toBe(false);
  expect(
    shouldRotateSegment({
      heardSpeech: false,
      silentMs: 0,
      segmentMs: VOICE_SEGMENT_MAX_MS,
    }),
  ).toBe(true);
});

test('requests interims only for new speech audio, one at a time', () => {
  const base = {
    sinceLastMs: VOICE_INTERIM_INTERVAL_MS,
    inFlight: false,
    hasNewAudio: true,
    heardSpeech: true,
  };
  expect(shouldRequestInterim(base)).toBe(true);
  expect(shouldRequestInterim({ ...base, inFlight: true })).toBe(false);
  expect(shouldRequestInterim({ ...base, hasNewAudio: false })).toBe(false);
  expect(shouldRequestInterim({ ...base, heardSpeech: false })).toBe(false);
  expect(
    shouldRequestInterim({
      ...base,
      sinceLastMs: VOICE_INTERIM_INTERVAL_MS - 1,
    }),
  ).toBe(false);
});
