import type { JevSegmentOutcome } from './jev-filter';
import {
  buildJevTranscriptLines,
  jevTranscriptSummary,
  jevTranscriptText,
} from './jev-transcript';

const segments = [
  { index: 2, text: 'Maybe later or perhaps tomorrow.', final: true },
  {
    index: 0,
    text: 'We already ate dinner. Could you summarize my notes?',
    final: true,
  },
  { index: 1, text: 'Highlight the major third.', final: true },
  { index: 3, text: '', final: true },
  { index: 4, text: 'And then show', final: false },
];

const outcomes = new Map<number, JevSegmentOutcome>([
  [
    0,
    {
      status: 'sent',
      startWord: 4,
      text: 'Could you summarize my notes?',
      at: 1,
    },
  ],
  [1, { status: 'held', reason: 'unclear' }],
  [2, { status: 'held', reason: 'ambient' }],
]);

test('marks exactly the sent span of each segment, in order', () => {
  const lines = buildJevTranscriptLines(segments, outcomes, { live: true });
  expect(lines.map(line => [line.segment, line.status])).toEqual([
    [0, 'sent'],
    [1, 'unclear'],
    [2, 'ambient'],
    [4, 'listening'],
  ]);
  expect(lines[0].pieces).toEqual([
    { text: 'We already ate dinner.', sent: false },
    { text: 'Could you summarize my notes?', sent: true },
  ]);
  expect(lines[0].sentText).toBe('Could you summarize my notes?');
  expect(lines[0].unsentText).toBe('We already ate dinner.');
  expect(lines[1]).toMatchObject({
    pieces: [{ text: 'Highlight the major third.', sent: false }],
    sentText: null,
    unsentText: 'Highlight the major third.',
  });
});

test('undecided segments read as not sent once the session ends', () => {
  const lines = buildJevTranscriptLines(segments, outcomes, { live: false });
  expect(lines.at(-1)).toMatchObject({ segment: 4, status: 'unsent' });
});

test('a fully sent segment has a single highlighted piece', () => {
  const [line] = buildJevTranscriptLines(
    [{ index: 0, text: 'Highlight the major third.', final: true }],
    new Map([
      [
        0,
        {
          status: 'sent',
          startWord: 0,
          text: 'Highlight the major third.',
          at: 0,
        },
      ],
    ]),
    { live: false },
  );
  expect(line.pieces).toEqual([
    { text: 'Highlight the major third.', sent: true },
  ]);
  expect(line.unsentText).toBe('');
});

test('summarizes and copies the whole transcript', () => {
  const lines = buildJevTranscriptLines(segments, outcomes, { live: false });
  expect(jevTranscriptSummary(lines)).toEqual({
    total: 4,
    sent: 1,
    notSent: 3,
  });
  expect(jevTranscriptText(lines)).toBe(
    [
      'We already ate dinner. Could you summarize my notes?',
      'Highlight the major third.',
      'Maybe later or perhaps tomorrow.',
      'And then show',
    ].join('\n'),
  );
});
