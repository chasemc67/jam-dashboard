import {
  buildJevEvaluationRequest,
  candidateWindows,
  jevConfidenceGate,
  jevQuestionIds,
  parseJevAnswers,
  parseJevRequestBody,
  readJevResponse,
  type JevCandidate,
  type JevDecision,
} from './jev';

const words = 'We already ate dinner. Could you summarize my notes?'.split(' ');

function decision(
  startIndex: number,
  addressing: JevDecision['addressing'],
  p = 0.9,
): JevDecision {
  return {
    startIndex,
    addressing,
    directedProbability: addressing === 'directed' ? p : 0.05,
    ambientProbability: addressing === 'ambient' ? p : 0.05,
    isDirectedProbability: addressing === 'directed' ? p : 0.1,
  };
}

describe('candidateWindows', () => {
  test('builds the floor plus the last K suffixes, in order', () => {
    const candidates = candidateWindows(words, null, 0, 3, 40);
    expect(candidates.map(c => c.startIndex)).toEqual([0, 6, 7, 8]);
    expect(candidates[0].text).toBe(words.join(' '));
    expect(candidates[3].text).toBe('notes?');
  });

  test('respects excluded words, the max window, and a held startIndex', () => {
    expect(candidateWindows(words, 4, 2, 2, 40).map(c => c.startIndex)).toEqual(
      [2, 4, 7, 8],
    );
    expect(
      candidateWindows(words, null, 0, 1, 3).map(c => c.startIndex),
    ).toEqual([6, 8]);
    expect(candidateWindows(words, null, words.length)).toEqual([]);
  });
});

describe('jevConfidenceGate', () => {
  const candidates: JevCandidate[] = [0, 4, 8].map(startIndex => ({
    startIndex,
    text: words.slice(startIndex).join(' '),
  }));

  test('accepts the earliest candidate passing both thresholds', () => {
    const gate = jevConfidenceGate(
      {
        decisions: [
          decision(0, 'ambient', 0.7),
          decision(4, 'directed'),
          decision(8, 'directed'),
        ],
      },
      candidates,
    );
    expect(gate).toMatchObject({ kind: 'directed', startIndex: 4 });
  });

  test('requires the Boolean as well as the Choice', () => {
    const weakBoolean = {
      ...decision(4, 'directed'),
      isDirectedProbability: 0.4,
    };
    expect(
      jevConfidenceGate(
        {
          decisions: [
            decision(0, 'unclear'),
            weakBoolean,
            decision(8, 'unclear'),
          ],
        },
        candidates,
      ),
    ).toEqual({ kind: 'unclear' });
  });

  test('confident ambient whole window excludes; otherwise holds', () => {
    expect(
      jevConfidenceGate(
        {
          decisions: [
            decision(0, 'ambient'),
            decision(4, 'ambient'),
            decision(8, 'unclear'),
          ],
        },
        candidates,
      ),
    ).toEqual({ kind: 'ambient' });
    expect(
      jevConfidenceGate(
        {
          decisions: [
            decision(0, 'ambient', 0.5),
            decision(4, 'unclear'),
            decision(8, 'unclear'),
          ],
        },
        candidates,
      ),
    ).toEqual({ kind: 'unclear' });
  });

  test('fails closed on errors and inconsistent decisions', () => {
    const directedAll = candidates.map(c => decision(c.startIndex, 'directed'));
    expect(
      jevConfidenceGate({ decisions: directedAll, error: 'boom' }, candidates),
    ).toEqual({ kind: 'unclear' });
    expect(
      jevConfidenceGate({ decisions: directedAll.slice(1) }, candidates),
    ).toEqual({ kind: 'unclear' });
    expect(
      jevConfidenceGate(
        {
          decisions: [directedAll[0], directedAll[0], directedAll[2]],
        },
        candidates,
      ),
    ).toEqual({ kind: 'unclear' });
    expect(
      jevConfidenceGate(
        {
          decisions: [
            { ...directedAll[0], directedProbability: 1.4 },
            directedAll[1],
            directedAll[2],
          ],
        },
        candidates,
      ),
    ).toEqual({ kind: 'unclear' });
  });
});

describe('request and answers', () => {
  const body = {
    context: words.join(' '),
    candidates: [
      { startIndex: 0, text: words.join(' ') },
      { startIndex: 4, text: words.slice(4).join(' ') },
    ],
  };

  test('asks one Choice and one Boolean per candidate about the Jam assistant', () => {
    const request = buildJevEvaluationRequest(body);
    expect(Object.keys(request.questions)).toEqual([
      'candidate_0_addressing',
      'candidate_0_is_directed',
      'candidate_4_addressing',
      'candidate_4_is_directed',
    ]);
    expect(request.questions.candidate_4_addressing.type).toBe('choice');
    expect(request.questions.candidate_4_is_directed.type).toBe('boolean');
    expect(request.state.agent).toMatch(/Jam Dashboard/);
    expect(request.state.candidates).toEqual(body.candidates);
  });

  test('parses answers with probabilities and rejects malformed ones', () => {
    const answers = Object.fromEntries(
      body.candidates.flatMap(({ startIndex }) => {
        const ids = jevQuestionIds(startIndex);
        return [
          [
            ids.addressing,
            {
              type: 'choice',
              choice: startIndex === 4 ? 'directed' : 'ambient',
              probabilities: { directed: 0.8, ambient: 0.15, unclear: 0.05 },
            },
          ],
          [ids.isDirected, { type: 'boolean', probability: 0.7 }],
        ];
      }),
    );
    expect(parseJevAnswers(body, answers)).toEqual([
      {
        startIndex: 0,
        addressing: 'ambient',
        directedProbability: 0.8,
        ambientProbability: 0.15,
        isDirectedProbability: 0.7,
      },
      {
        startIndex: 4,
        addressing: 'directed',
        directedProbability: 0.8,
        ambientProbability: 0.15,
        isDirectedProbability: 0.7,
      },
    ]);
    expect(() => parseJevAnswers(body, null)).toThrow();
    expect(() =>
      parseJevAnswers(body, {
        ...answers,
        candidate_4_addressing: { type: 'choice', choice: 'directed' },
      }),
    ).toThrow();
  });

  test('validates request bodies from the network', () => {
    expect(parseJevRequestBody(body)).toEqual(body);
    expect(parseJevRequestBody(null)).toBeNull();
    expect(parseJevRequestBody({ context: 'x', candidates: [] })).toBeNull();
    expect(
      parseJevRequestBody({
        context: 'x',
        candidates: [
          { startIndex: 1, text: 'a' },
          { startIndex: 1, text: 'b' },
        ],
      }),
    ).toBeNull();
    expect(
      parseJevRequestBody({
        context: 'x',
        candidates: [{ startIndex: -1, text: 'a' }],
      }),
    ).toBeNull();
    expect(
      parseJevRequestBody({
        context: 'x',
        candidates: [{ startIndex: 0, text: ' ' }],
      }),
    ).toBeNull();
  });

  test('reads responses and fails closed on errors', () => {
    const decisions = [decision(0, 'directed')];
    expect(readJevResponse({ decisions }, true, '')).toEqual({ decisions });
    expect(readJevResponse({ error: 'Nope' }, false, '')).toEqual({
      decisions: [],
      error: 'Nope',
    });
    expect(readJevResponse('bad', false, 'Bad gateway')).toEqual({
      decisions: [],
      error: 'Bad gateway',
    });
  });
});
