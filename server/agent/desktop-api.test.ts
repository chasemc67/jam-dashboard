import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopAgentApi, isDesktopAgentApiURL } from './desktop-api';
import { MCP_UNAVAILABLE_MESSAGE } from '../../app/agent/chat-config';
import {
  DESKTOP_AGENT_REQUEST_HEADER,
  GATEWAY_KEY_MISSING_MESSAGE,
} from '../../app/agent/gateway-key';

const key = `vck_${'M5n6B7v8'.repeat(6)}`;
const connection = {
  url: 'http://127.0.0.1:4177/mcp',
  token: 'b'.repeat(64),
};

function post(path: string, headers: Record<string, string> = {}) {
  return new Request(`jam://dashboard${path}`, {
    method: 'POST',
    headers: { [DESKTOP_AGENT_REQUEST_HEADER]: '1', ...headers },
    body: '{"messages":[]}',
  });
}

function setup(
  overrides: Partial<Parameters<typeof createDesktopAgentApi>[0]> = {},
) {
  const calls: {
    route: string;
    env: Record<string, string | undefined>;
    gateway: unknown;
  }[] = [];
  const providers: string[] = [];
  const handle = createDesktopAgentApi({
    getGatewayKey: async () => key,
    getMcpConnection: () => connection,
    env: {
      JAM_AGENT_CHAT_MODEL: 'openai/gpt-5.4-mini',
      AI_GATEWAY_API_KEY: 'ignored-process-key',
      UNRELATED_SECRET: 'nope',
    },
    chat: async (_request, deps) => {
      calls.push({ route: 'chat', env: deps!.env!, gateway: deps!.gateway });
      return new Response('chat');
    },
    transcribe: async (_request, deps) => {
      calls.push({
        route: 'transcribe',
        env: deps!.env!,
        gateway: deps!.gateway,
      });
      return new Response('transcribe');
    },
    createProvider: apiKey => {
      providers.push(apiKey);
      return { provider: apiKey } as never;
    },
    ...overrides,
  });
  return { handle, calls, providers };
}

test('recognizes only jam://dashboard/api URLs', () => {
  assert.equal(isDesktopAgentApiURL('jam://dashboard/api/agent-chat'), true);
  assert.equal(isDesktopAgentApiURL('jam://dashboard/assets/app.js'), false);
  assert.equal(isDesktopAgentApiURL('jam://other/api/agent-chat'), false);
  assert.equal(isDesktopAgentApiURL('https://dashboard/api/agent-chat'), false);
});

test('routes chat and voice with the per-request key and local MCP', async () => {
  const { handle, calls, providers } = setup();
  assert.equal(await (await handle(post('/api/agent-chat'))).text(), 'chat');
  assert.equal(
    await (await handle(post('/api/agent-transcribe'))).text(),
    'transcribe',
  );
  assert.deepEqual(providers, [key, key]);
  assert.deepEqual(calls[0], {
    route: 'chat',
    env: {
      AI_GATEWAY_API_KEY: key,
      JAM_AGENT_URL: connection.url,
      JAM_AGENT_TOKEN: connection.token,
      JAM_AGENT_CHAT_MODEL: 'openai/gpt-5.4-mini',
      JAM_AGENT_TRANSCRIBE_MODEL: undefined,
    },
    gateway: { provider: key },
  });
  assert.equal(calls[1].route, 'transcribe');
});

test('rejects unknown routes, other methods, and requests without the app header', async () => {
  const { handle, calls } = setup();
  assert.equal((await handle(post('/api/other'))).status, 404);
  assert.equal(
    (await handle(new Request('jam://dashboard/api/agent-chat'))).status,
    405,
  );
  const foreign = new Request('jam://dashboard/api/agent-transcribe', {
    method: 'POST',
    body: 'x',
  });
  assert.equal((await handle(foreign)).status, 403);
  assert.equal(calls.length, 0);
});

test('asks for a key when none is stored', async () => {
  const { handle, calls } = setup({ getGatewayKey: async () => null });
  const response = await handle(post('/api/agent-chat'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: GATEWAY_KEY_MISSING_MESSAGE,
  });
  assert.equal(calls.length, 0);
});

test('reports Keychain failures and a stopped MCP service', async () => {
  const keychain = setup({
    getGatewayKey: async () => {
      throw new Error('Keychain could not read the key: denied.');
    },
  });
  const failed = await keychain.handle(post('/api/agent-chat'));
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), {
    error: 'Keychain could not read the key: denied.',
  });
  const mcp = setup({ getMcpConnection: () => undefined });
  const stopped = await mcp.handle(post('/api/agent-transcribe'));
  assert.equal(stopped.status, 503);
  assert.deepEqual(await stopped.json(), { error: MCP_UNAVAILABLE_MESSAGE });
});
