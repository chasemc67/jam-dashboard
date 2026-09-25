/**
 * @jest-environment node
 */
jest.mock('ai', () => ({
  experimental_evaluate: jest.fn(),
  gateway: { evaluationModel: jest.fn() },
}));

import {
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
} from './chat-config';
import {
  JEV_FAILED_MESSAGE,
  JEV_MALFORMED_MESSAGE,
  JEV_MODEL,
  JEV_REQUEST_INVALID_MESSAGE,
  JEV_TIMEOUT_MESSAGE,
  jevQuestionIds,
} from './jev';
import { handleAgentJevRequest } from './jev.server';

const env = { AI_GATEWAY_API_KEY: 'key' };
const body = {
  context: 'We already ate dinner. Could you summarize my notes?',
  candidates: [
    {
      startIndex: 0,
      text: 'We already ate dinner. Could you summarize my notes?',
    },
    { startIndex: 4, text: 'Could you summarize my notes?' },
  ],
};

function post(value: unknown) {
  return new Request('http://localhost/api/agent-jev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
}

function answersFor(directedIndex: number) {
  return Object.fromEntries(
    body.candidates.flatMap(({ startIndex }) => {
      const ids = jevQuestionIds(startIndex);
      const directed = startIndex === directedIndex;
      return [
        [
          ids.addressing,
          {
            type: 'choice',
            choice: directed ? 'directed' : 'ambient',
            probabilities: directed
              ? { directed: 0.9, ambient: 0.05, unclear: 0.05 }
              : { directed: 0.1, ambient: 0.85, unclear: 0.05 },
          },
        ],
        [
          ids.isDirected,
          { type: 'boolean', probability: directed ? 0.9 : 0.1 },
        ],
      ];
    }),
  );
}

test('rejects invalid bodies and missing credentials', async () => {
  const invalid = await handleAgentJevRequest(post('not json'), { env });
  expect(invalid.status).toBe(400);
  await expect(invalid.json()).resolves.toEqual({
    error: JEV_REQUEST_INVALID_MESSAGE,
  });
  expect(
    (
      await handleAgentJevRequest(post({ context: 'x', candidates: [] }), {
        env,
      })
    ).status,
  ).toBe(400);

  const noKey = await handleAgentJevRequest(post(body), { env: {} });
  expect(noKey.status).toBe(503);
  await expect(noKey.json()).resolves.toEqual({
    error: GATEWAY_UNAVAILABLE_MESSAGE,
  });
});

test('evaluates every candidate with Jev through the injected Gateway', async () => {
  const model = { id: 'jev-model' };
  const gateway = { evaluationModel: jest.fn(() => model) };
  const evaluate = jest.fn(async ({ gateway: provider, request }) => {
    expect(provider).toBe(gateway);
    expect(Object.keys(request.questions)).toHaveLength(4);
    expect(request.state.context).toBe(body.context);
    return { answers: answersFor(4) };
  });
  const response = await handleAgentJevRequest(post(body), {
    env,
    gateway: gateway as never,
    evaluate,
  });
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.decisions).toHaveLength(2);
  expect(json.decisions[1]).toEqual({
    startIndex: 4,
    addressing: 'directed',
    directedProbability: 0.9,
    ambientProbability: 0.05,
    isDirectedProbability: 0.9,
  });
});

test('uses typesafe-ai/jev with one bounded retry by default', async () => {
  const { experimental_evaluate } = jest.requireMock('ai') as {
    experimental_evaluate: jest.Mock;
  };
  experimental_evaluate.mockResolvedValueOnce({ answers: answersFor(4) });
  const gateway = { evaluationModel: jest.fn(() => 'jev') };
  const response = await handleAgentJevRequest(post(body), {
    env,
    gateway: gateway as never,
  });
  expect(response.status).toBe(200);
  expect(gateway.evaluationModel).toHaveBeenCalledWith(JEV_MODEL);
  expect(experimental_evaluate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'jev',
      maxRetries: 1,
      providerOptions: { gateway: { only: ['typesafe-ai'] } },
    }),
  );
});

test('fails closed on malformed answers, timeouts, and Gateway errors', async () => {
  const malformed = await handleAgentJevRequest(post(body), {
    env,
    evaluate: async () => ({ answers: { nope: true } }),
  });
  expect(malformed.status).toBe(502);
  await expect(malformed.json()).resolves.toEqual({
    error: JEV_MALFORMED_MESSAGE,
  });

  const slow = await handleAgentJevRequest(post(body), {
    env,
    timeoutMs: 10,
    evaluate: ({ abortSignal }) =>
      new Promise((_, reject) =>
        abortSignal.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
  });
  expect(slow.status).toBe(504);
  await expect(slow.json()).resolves.toEqual({ error: JEV_TIMEOUT_MESSAGE });

  const rejected = await handleAgentJevRequest(post(body), {
    env,
    evaluate: async () => {
      throw new Error('AI Gateway authentication failed: Invalid API key');
    },
  });
  expect(rejected.status).toBe(503);
  await expect(rejected.json()).resolves.toEqual({
    error: GATEWAY_KEY_REJECTED_MESSAGE,
  });

  const leaky = await handleAgentJevRequest(post(body), {
    env,
    evaluate: async () => {
      throw new Error(`upstream 500 while evaluating "${body.context}"`);
    },
  });
  expect(leaky.status).toBe(502);
  await expect(leaky.json()).resolves.toEqual({ error: JEV_FAILED_MESSAGE });
});
