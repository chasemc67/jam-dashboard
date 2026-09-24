import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  convertArrayToReadableStream,
  MockLanguageModelV4,
  MockTranscriptionModelV4,
} from 'ai/test';
import { startAgentService } from './service';
import { createDesktopAgentApi } from './desktop-api';
import { DESKTOP_AGENT_REQUEST_HEADER } from '../../app/agent/gateway-key';

const key = `vck_${'P0o9I8u7'.repeat(6)}`;
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

test('desktop chat calls local MCP tools with a per-user Gateway provider', async () => {
  const token = randomBytes(32).toString('hex');
  const service = await startAgentService({ token, port: 0 });
  const providerKeys: string[] = [];
  const modelIds: string[] = [];
  const model = new MockLanguageModelV4({
    doStream: [
      {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_scale',
            input: JSON.stringify({ scale: 'D dorian' }),
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage,
          },
        ]),
      },
      {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'D dorian is ready.' },
          { type: 'text-end', id: 't1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage,
          },
        ]),
      },
    ],
  });
  try {
    const handle = createDesktopAgentApi({
      getGatewayKey: async () => key,
      getMcpConnection: () => ({ url: service.url, token }),
      env: { JAM_AGENT_CHAT_MODEL: 'openai/test-model' },
      createProvider: apiKey => {
        providerKeys.push(apiKey);
        return {
          languageModel: (id: string) => {
            modelIds.push(id);
            return model;
          },
        } as never;
      },
    });
    const response = await handle(
      new Request('jam://dashboard/api/agent-chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [DESKTOP_AGENT_REQUEST_HEADER]: '1',
        },
        body: JSON.stringify({
          messages: [
            {
              id: 'u1',
              role: 'user',
              parts: [{ type: 'text', text: 'Show D dorian' }],
            },
          ],
        }),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.deepEqual(providerKeys, [key]);
    assert.deepEqual(modelIds, ['openai/test-model']);
    assert.match(body, /"type":"tool-output-available"/);
    assert.match(body, /"notes":\["D","E","F","G","A","B","C"\]/);
    assert.match(body, /D dorian is ready\./);
    assert.ok(!body.includes(key));
    const secondCall = JSON.stringify(model.doStreamCalls[1].prompt);
    assert.match(secondCall, /get_scale/);
  } finally {
    await service.close();
  }
});

test('desktop voice transcribes with the per-user Gateway provider', async () => {
  const token = randomBytes(32).toString('hex');
  const models: string[] = [];
  const handle = createDesktopAgentApi({
    getGatewayKey: async () => key,
    getMcpConnection: () => ({ url: 'http://127.0.0.1:4177/mcp', token }),
    env: {},
    createProvider: () =>
      ({
        transcriptionModel: (id: string) => {
          models.push(id);
          return new MockTranscriptionModelV4({
            doGenerate: async () => ({
              text: 'Show B major',
              segments: [],
              language: 'en',
              durationInSeconds: 1,
              warnings: [],
              response: { timestamp: new Date(), modelId: id },
            }),
          });
        },
      }) as never,
  });
  const form = new FormData();
  form.append(
    'audio',
    new Blob([new Uint8Array(64)], { type: 'audio/webm' }),
    'voice.webm',
  );
  const response = await handle(
    new Request('jam://dashboard/api/agent-transcribe', {
      method: 'POST',
      headers: { [DESKTOP_AGENT_REQUEST_HEADER]: '1' },
      body: form,
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'Show B major' });
  assert.deepEqual(models, ['openai/whisper-1']);
});
