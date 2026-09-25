import type { JevAddressing, JevEvaluator, JevRequestBody } from './jev';
import { JevSpeechFilter, type JevTranscriptSegment } from './jev-filter';

const DIRECTED = [
  'Could you summarize my notes?',
  'Show B major on the fretboard.',
  'Highlight the major third.',
];

/** Scripted Jev: known requests are directed, anything with other words is ambient. */
function scripted(text: string): JevAddressing {
  const normalized = text.toLowerCase().replace(/[^a-z ]/g, '');
  if (
    DIRECTED.some(d => d.toLowerCase().replace(/[^a-z ]/g, '') === normalized)
  ) {
    return 'directed';
  }
  if (DIRECTED.some(d => d.toLowerCase().includes(normalized)))
    return 'unclear';
  return 'ambient';
}

function setup({
  classify = scripted,
  latencyMs = 200,
  fail = false,
}: {
  classify?: (text: string) => JevAddressing;
  latencyMs?: number;
  fail?: boolean;
} = {}) {
  const submitted: string[] = [];
  const errors: string[] = [];
  const calls: JevRequestBody[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const evaluate: JevEvaluator = (body, signal) => {
    calls.push(body);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        inFlight -= 1;
        if (fail) {
          resolve({ decisions: [], error: 'Jev could not classify speech.' });
          return;
        }
        resolve({
          decisions: body.candidates.map(({ startIndex, text }) => {
            const addressing = classify(text);
            return {
              startIndex,
              addressing,
              directedProbability: addressing === 'directed' ? 0.9 : 0.05,
              ambientProbability: addressing === 'ambient' ? 0.9 : 0.05,
              isDirectedProbability: addressing === 'directed' ? 0.9 : 0.1,
            };
          }),
        });
      }, latencyMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        inFlight -= 1;
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  };
  const filter = new JevSpeechFilter({
    evaluate,
    onSubmit: ({ text }) => submitted.push(text),
    onError: message => errors.push(message),
  });
  return {
    filter,
    submitted,
    errors,
    calls,
    maxInFlight: () => maxInFlight,
  };
}

const seg = (
  index: number,
  text: string,
  final: boolean,
  lastSpeechAt = Date.now(),
): JevTranscriptSegment => ({ index, text, final, lastSpeechAt });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('submits a directed segment once, after its final transcript and a quiet interval', async () => {
  const { filter, submitted } = setup();
  filter.update([seg(0, 'Show B major on the fretboard', false)]);
  await jest.advanceTimersByTimeAsync(2000);
  // Directed, but the segment isn't final yet: hold.
  expect(submitted).toEqual([]);

  const spokeAt = Date.now();
  filter.update([seg(0, 'Show B major on the fretboard.', true, spokeAt)]);
  await jest.advanceTimersByTimeAsync(1000);
  expect(submitted).toEqual([]);
  await jest.advanceTimersByTimeAsync(600);
  expect(submitted).toEqual(['Show B major on the fretboard.']);

  filter.update([seg(0, 'Show B major on the fretboard.', true)]);
  await jest.advanceTimersByTimeAsync(3000);
  expect(submitted).toHaveLength(1);
  expect(filter.outcomes().get(0)).toMatchObject({
    status: 'sent',
    startWord: 0,
    text: 'Show B major on the fretboard.',
  });
});

test('ambient speech is held and never submitted', async () => {
  const { filter, submitted } = setup();
  filter.update([seg(0, 'The television is still playing.', true, 0)]);
  await jest.advanceTimersByTimeAsync(3000);
  expect(submitted).toEqual([]);
  expect(filter.outcomes().get(0)).toEqual({
    status: 'held',
    reason: 'ambient',
  });
});

test('trims an ambient prefix and submits only the directed suffix', async () => {
  const { filter, submitted } = setup();
  filter.update([
    seg(0, 'We already ate dinner. Could you summarize my notes?', true, 0),
  ]);
  await jest.advanceTimersByTimeAsync(2000);
  expect(submitted).toEqual(['Could you summarize my notes?']);
  expect(filter.outcomes().get(0)).toMatchObject({
    status: 'sent',
    startWord: 4,
  });
});

test('an interim rewritten from scratch drops the stale ambient exclusion', async () => {
  const { filter, submitted, calls } = setup();
  filter.update([seg(0, "You've got tofloat your", false, 0)]);
  await jest.advanceTimersByTimeAsync(300);
  filter.update([seg(0, 'Show B major on the fretboard.', true, 0)]);
  await jest.advanceTimersByTimeAsync(300);
  expect(calls[1].candidates[0].startIndex).toBe(0);
  expect(submitted).toEqual(['Show B major on the fretboard.']);
});

test('ambient words stay excluded while the transcript only grows', async () => {
  const { filter, submitted, calls } = setup();
  filter.update([seg(0, 'We already ate dinner.', false, 0)]);
  await jest.advanceTimersByTimeAsync(300);
  filter.update([
    seg(0, 'We already ate dinner. Could you summarize my notes?', true, 0),
  ]);
  await jest.advanceTimersByTimeAsync(300);
  expect(calls[1].candidates[0].startIndex).toBe(4);
  expect(submitted).toEqual(['Could you summarize my notes?']);
});

test('a revision revokes a directed decision until re-evaluated', async () => {
  const { filter, submitted, calls } = setup();
  filter.update([seg(0, 'Show B major on the fretboard', false)]);
  await jest.advanceTimersByTimeAsync(500);
  // The final hears more: now it's a conversation, not a request.
  filter.update([
    seg(0, 'Show B major on the fretboard is what he said', true, Date.now()),
  ]);
  await jest.advanceTimersByTimeAsync(3000);
  expect(calls).toHaveLength(2);
  expect(submitted).toEqual([]);
  expect(filter.outcomes().get(0)).toMatchObject({ status: 'held' });
});

test('punctuation-only final revisions keep the decision without re-evaluating', async () => {
  const { filter, submitted, calls } = setup();
  filter.update([seg(0, 'show b major on the fretboard', false, 0)]);
  await jest.advanceTimersByTimeAsync(500);
  filter.update([seg(0, 'Show B major on the fretboard.', true, 0)]);
  await jest.advanceTimersByTimeAsync(0);
  expect(calls).toHaveLength(1);
  expect(submitted).toEqual(['Show B major on the fretboard.']);
});

test('errors fail closed and report the message', async () => {
  const { filter, submitted, errors } = setup({ fail: true });
  filter.update([seg(0, 'Show B major on the fretboard.', true, 0)]);
  await jest.advanceTimersByTimeAsync(2000);
  expect(submitted).toEqual([]);
  expect(errors).toEqual(['Jev could not classify speech.']);
  expect(filter.outcomes().get(0)).toEqual({ status: 'held', reason: 'error' });
});

test('keeps listening: multiple directed requests submit in order around ambient speech', async () => {
  const { filter, submitted, maxInFlight } = setup();
  const segments: JevTranscriptSegment[] = [];
  const say = async (text: string) => {
    const index = segments.length;
    segments.push(seg(index, text, false));
    filter.update([...segments]);
    await jest.advanceTimersByTimeAsync(700);
    segments[index] = seg(index, text, true, Date.now() - 700);
    filter.update([...segments]);
    await jest.advanceTimersByTimeAsync(300);
  };
  await say('Show B major on the fretboard.');
  await say('Did you feed the cat this morning?');
  await say('Highlight the major third.');
  await jest.advanceTimersByTimeAsync(3000);
  expect(submitted).toEqual([
    'Show B major on the fretboard.',
    'Highlight the major third.',
  ]);
  expect(filter.outcomes().get(1)).toEqual({
    status: 'held',
    reason: 'ambient',
  });
  expect(maxInFlight()).toBe(1);
});

test('finish() flushes without waiting for the quiet interval; stop() never submits', async () => {
  const first = setup();
  first.filter.update([seg(0, 'Highlight the major third.', true, Date.now())]);
  const finished = first.filter.finish();
  await jest.advanceTimersByTimeAsync(250);
  await finished;
  expect(first.submitted).toEqual(['Highlight the major third.']);

  const second = setup();
  second.filter.update([
    seg(0, 'Highlight the major third.', true, Date.now()),
  ]);
  second.filter.stop();
  await jest.advanceTimersByTimeAsync(3000);
  expect(second.submitted).toEqual([]);
});

test('empty segments are ignored', async () => {
  const { filter, calls } = setup();
  filter.update([seg(0, '', true), seg(1, '   ', false)]);
  await jest.advanceTimersByTimeAsync(2000);
  expect(calls).toEqual([]);
  expect(filter.outcomes().size).toBe(0);
});
