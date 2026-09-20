import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { WebSocket } from 'ws';
import { startAgentService, tokenMatches, validRequestSource } from './service';
import { SessionRegistry } from './sessions';
import { initialState } from '../../shared/agent/fixtures';
import { prepareCommand } from '../../shared/agent/commands';
import { ToolOutputSchema } from '../../shared/agent/tools';
import type { CommandRequest } from '../../shared/agent/contract';
import {
  getMcpToolReference,
  MCP_PROMPT_TEMPLATES,
  MCP_SERVER_INFO,
  MCP_SERVER_INSTRUCTIONS,
} from '../../shared/agent/reference';

test('loopback source and constant-time token guards reject malformed requests', () => {
  assert.equal(tokenMatches('é', 'a'), false);
  assert.equal(tokenMatches(undefined, 'a'), false);
  assert.equal(
    validRequestSource({ headers: { host: 'attacker.example:4177' } }, []),
    false,
  );
  assert.equal(
    validRequestSource(
      { headers: { host: '127.0.0.1:4177', origin: 'https://evil.example' } },
      [],
    ),
    false,
  );
});

test('registry requires explicit session selection, commit acknowledgments and rejects lost/busy commands', async () => {
  const registry = new SessionRegistry(30);
  let sent: CommandRequest | undefined;
  const first = registry.attach('desktop', initialState(), request => {
    sent = request;
  });
  const second = registry.attach('chrome', initialState(), () => {});
  assert.throws(() => registry.getState(), /Multiple/);
  const result = registry.execute(
    { type: 'show_fretboard', input: { chord: 'C' } },
    first,
  );
  assert.throws(
    () => registry.execute({ type: 'set_view', input: {} }, first),
    /awaiting a render/,
  );
  assert.equal(registry.getState(first).display.kind, 'scale');
  registry.reply(first, {
    id: sent!.id,
    state: { ...prepareCommand(initialState(), sent!.command), revision: 2 },
  });
  assert.equal((await result).display.kind, 'notes');
  registry.detach(second);
  await assert.rejects(
    registry.execute({ type: 'set_view', input: {} }),
    /did not acknowledge/,
  );
  const disconnected = registry.execute({ type: 'set_view', input: {} });
  registry.detach(first);
  await assert.rejects(disconnected, /disconnected/);
  assert.equal(registry.listSessions().length, 0);
});

for (const mode of ['legacy', 'auto'] as const) {
  test(`official MCP client connects via ${mode} protocol and uses the browser bridge`, async () => {
    const token = randomBytes(32).toString('hex');
    const service = await startAgentService({
      token,
      port: 0,
      browserOrigins: ['http://127.0.0.1:5173'],
    });
    const client = new Client(
      { name: 'jam-test', version: '1.0.0' },
      { versionNegotiation: { mode } },
    );
    let browser: WebSocket | undefined;
    try {
      const unauthorized = await fetch(service.url, {
        method: 'POST',
        body: '{}',
      });
      assert.equal(unauthorized.status, 401);
      const rejectedOrigin = await fetch(service.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: 'https://evil.example',
        },
        body: '{}',
      });
      assert.equal(rejectedOrigin.status, 403);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(service.url), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      const tools = await client.listTools();
      assert.equal(tools.tools.length, 14);
      // The in-app technical reference must match the exact published surface,
      // including the SDK's conversion direction and JSON Schema draft.
      assert.deepEqual(
        tools.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
        })),
        getMcpToolReference(),
      );
      assert.deepEqual(client.getServerVersion(), MCP_SERVER_INFO);
      assert.equal(client.getInstructions(), MCP_SERVER_INSTRUCTIONS);
      assert.equal(client.getServerCapabilities()?.prompts, undefined);
      assert.deepEqual(MCP_PROMPT_TEMPLATES, []);
      const capabilities = await client.callTool({
        name: 'get_capabilities',
        arguments: {},
      });
      assert.equal(capabilities.isError, false);
      assert.equal(
        (
          ToolOutputSchema.parse(capabilities.structuredContent).data as {
            songAnalysis: { available: boolean };
          }
        ).songAnalysis.available,
        false,
      );
      for (const [name, args] of [
        ['analyze_song', { query: 'Blue Skies Ella Fitzgerald' }],
        ['get_song_analysis', {}],
        [
          'cancel_song_analysis',
          { jobId: 'e180b129-51ef-40de-90f5-a5bf6c566702' },
        ],
      ] as const) {
        const unavailable = await client.callTool({ name, arguments: args });
        assert.equal(unavailable.isError, true);
        assert.equal(
          ToolOutputSchema.parse(unavailable.structuredContent).error?.code,
          'ANALYZER_UNAVAILABLE',
        );
      }
      assert.equal(
        tools.tools.find(t => t.name === 'get_chord')?.annotations
          ?.readOnlyHint,
        true,
      );
      const theory = await client.callTool({
        name: 'identify_chord',
        arguments: { notes: ['E', 'G', 'C'] },
      });
      assert.equal(theory.isError, false);
      assert.match(JSON.stringify(theory.structuredContent), /CM\/E/);
      const missing = await client.callTool({
        name: 'get_state',
        arguments: {},
      });
      assert.equal(missing.isError, true);
      browser = new WebSocket(
        service.url.replace('http:', 'ws:').replace('/mcp', '/bridge'),
        { origin: 'http://127.0.0.1:5173' },
      );
      await once(browser, 'open');
      const joined = once(browser, 'message');
      browser.send(
        JSON.stringify({ type: 'hello', token, state: initialState() }),
      );
      await joined;
      browser.on('message', raw => {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'command') return;
        const state = prepareCommand(
          service.registry.getState(),
          message.request.command,
        );
        state.revision++;
        browser!.send(
          JSON.stringify({
            type: 'reply',
            reply: { id: message.request.id, state },
          }),
        );
      });
      const result = await client.callTool({
        name: 'show_voicings',
        arguments: { chord: 'C/E' },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      assert.equal(service.registry.getState().display.kind, 'voicings');
      const sessions = service.registry.listSessions();
      assert.equal(sessions[0].platform, 'chrome');
      browser.close();
      await once(browser, 'close');
      // Disconnection must reach the service before the next MCP call returns.
      const noSession = await client.callTool({
        name: 'get_state',
        arguments: {},
      });
      assert.equal(noSession.isError, true);
    } finally {
      browser?.terminate();
      await client.close();
      await service.close();
    }
  });
}

test('WebSocket rejects missing or wrong-origin credentials and oversized MCP bodies', async () => {
  const token = randomBytes(32).toString('hex');
  const service = await startAgentService({
    token,
    port: 0,
    browserOrigins: ['http://127.0.0.1:5173'],
  });
  try {
    const socket = new WebSocket(
      service.url.replace('http:', 'ws:').replace('/mcp', '/bridge'),
      { origin: 'http://127.0.0.1:5173' },
    );
    await once(socket, 'open');
    const closed = once(socket, 'close');
    socket.send(
      JSON.stringify({ type: 'hello', token: 'wrong', state: initialState() }),
    );
    assert.equal((await closed)[0], 1008);
    assert.equal(service.registry.listSessions().length, 0);
    const response = await fetch(service.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ padding: 'a'.repeat(140_000) }),
    });
    assert.equal(response.status, 413);
  } finally {
    await service.close();
  }
});
