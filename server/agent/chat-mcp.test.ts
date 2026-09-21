import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createMCPClient } from '@ai-sdk/mcp';
import { startAgentService } from './service';

test('AI SDK MCP client authenticates and loads jam dashboard tools', async () => {
  const token = randomBytes(32).toString('hex');
  const service = await startAgentService({
    token,
    port: 0,
    browserOrigins: [],
  });
  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;
  try {
    client = await createMCPClient({
      clientName: 'jam-dashboard-chat-test',
      transport: {
        type: 'http',
        url: service.url,
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    const tools = await client.tools();
    assert.ok(tools.show_fretboard);
    assert.ok(tools.set_view);
    assert.ok(tools.list_sessions);
    assert.ok(tools.get_scale);
  } finally {
    await client?.close();
    await service.close();
  }
});
