import {
  DEFAULT_AGENT_CHAT_MODEL,
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
  JAM_CHAT_INSTRUCTIONS,
  MCP_UNAVAILABLE_MESSAGE,
  hasAiGatewayCredentials,
  isGatewayKeyRejected,
  jamMcpErrorMessage,
  prepareAgentChatRequest,
  resolveAgentChatModel,
  resolveJamMcpConnection,
} from './chat-config';

const token = 'a'.repeat(64);
const url = 'http://127.0.0.1:4178/mcp';

test('requires loopback MCP URL and hex token from agent:dev env', () => {
  expect(resolveJamMcpConnection({})).toEqual({
    ok: false,
    error: MCP_UNAVAILABLE_MESSAGE,
  });
  expect(
    resolveJamMcpConnection({
      JAM_AGENT_URL: 'http://localhost:4178/mcp',
      JAM_AGENT_TOKEN: token,
    }).ok,
  ).toBe(false);
  expect(
    resolveJamMcpConnection({
      JAM_AGENT_URL: url,
      JAM_AGENT_TOKEN: 'short',
    }).ok,
  ).toBe(false);
  expect(
    resolveJamMcpConnection({ JAM_AGENT_URL: url, JAM_AGENT_TOKEN: token }),
  ).toEqual({
    ok: true,
    url,
    token,
  });
});

test('prepareAgentChatRequest checks messages, gateway key, and MCP env', () => {
  expect(prepareAgentChatRequest({}, {})).toMatchObject({
    ok: false,
    status: 400,
  });
  expect(
    prepareAgentChatRequest(
      { messages: [] },
      { JAM_AGENT_URL: url, JAM_AGENT_TOKEN: token },
    ),
  ).toEqual({
    ok: false,
    status: 503,
    error: GATEWAY_UNAVAILABLE_MESSAGE,
  });
  expect(
    prepareAgentChatRequest({ messages: [] }, { AI_GATEWAY_API_KEY: 'key' }),
  ).toEqual({
    ok: false,
    status: 503,
    error: MCP_UNAVAILABLE_MESSAGE,
  });
  expect(
    prepareAgentChatRequest(
      { messages: [{ role: 'user' }] },
      {
        AI_GATEWAY_API_KEY: 'key',
        JAM_AGENT_URL: url,
        JAM_AGENT_TOKEN: token,
        JAM_AGENT_CHAT_MODEL: 'google/gemini-3.8-flash',
      },
    ),
  ).toEqual({
    ok: true,
    messages: [{ role: 'user' }],
    connection: { ok: true, url, token },
    model: 'google/gemini-3.8-flash',
  });
});

test('gateway and model helpers', () => {
  expect(hasAiGatewayCredentials({})).toBe(false);
  expect(hasAiGatewayCredentials({ VERCEL_OIDC_TOKEN: 'oidc' })).toBe(true);
  expect(resolveAgentChatModel({})).toBe(DEFAULT_AGENT_CHAT_MODEL);
  expect(JAM_CHAT_INSTRUCTIONS).toMatch(/show_fretboard/);
});

test('maps connection failures to the agent:dev message', () => {
  expect(
    jamMcpErrorMessage(new Error('connect ECONNREFUSED 127.0.0.1:4178')),
  ).toBe(MCP_UNAVAILABLE_MESSAGE);
  expect(jamMcpErrorMessage(new Error('something else'))).toBe(
    'something else',
  );
});

test('maps Gateway key rejections to the replace-key message, not MCP', () => {
  const error = new Error(
    'AI Gateway authentication failed: Invalid API key or token.\n\nCreate a new API key: https://vercel.com/...',
  );
  expect(isGatewayKeyRejected(error)).toBe(true);
  expect(jamMcpErrorMessage(error)).toBe(GATEWAY_KEY_REJECTED_MESSAGE);
  expect(jamMcpErrorMessage(new Error('HTTP 401 from MCP'))).toBe(
    MCP_UNAVAILABLE_MESSAGE,
  );
});
