import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { WebSocketServer, WebSocket } from 'ws';
import { agentTools } from '../../shared/agent/tools';
import {
  MCP_SERVER_INFO,
  MCP_SERVER_INSTRUCTIONS,
} from '../../shared/agent/reference';
import { ClientMessageSchema } from '../../shared/agent/wire';
import { SessionRegistry } from './sessions';
import type { ToolHost } from '../../shared/agent/contract';
import type { SongAnalyzerHost } from '../../shared/agent/song-analysis';

export const DEFAULT_MCP_PORT = 4177;
const MAX_BODY = 128 * 1024;
export function tokenMatches(value: string | undefined, token: string) {
  if (!value) return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(token);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
export function validRequestSource(
  req: Pick<IncomingMessage, 'headers'>,
  origins: string[],
) {
  const host = req.headers.host;
  if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) return false;
  const origin = req.headers.origin;
  return origin === undefined || origins.includes(origin);
}

export async function startAgentService({
  token,
  port = DEFAULT_MCP_PORT,
  browserOrigins = [],
  registry = new SessionRegistry(),
  songAnalyzer,
}: {
  token: string;
  port?: number;
  browserOrigins?: string[];
  registry?: SessionRegistry;
  songAnalyzer?: SongAnalyzerHost;
}) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error('Agent token must be 32 random bytes encoded as hex.');
  const host: ToolHost = {
    songAnalyzer,
    listSessions: () => registry.listSessions(),
    getState: id => registry.getState(id),
    execute: (command, id, revision) => registry.execute(command, id, revision),
  };
  const handler = createMcpHandler(() => {
    const mcp = new McpServer(MCP_SERVER_INFO, {
      instructions: MCP_SERVER_INSTRUCTIONS,
    });
    for (const tool of agentTools) {
      mcp.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
        },
        async input => {
          const result = await tool.execute(input, host);
          return {
            isError: !result.ok,
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          };
        },
      );
    }
    return mcp;
  });
  const handleMcp = toNodeHandler(handler);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!validRequestSource(req, browserOrigins)) {
      res.writeHead(403).end();
      return;
    }
    if (req.url !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (!tokenMatches(req.headers.authorization, `Bearer ${token}`)) {
      res.writeHead(401).end();
      return;
    }
    try {
      let bytes = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BODY) {
          res.writeHead(413).end();
          req.destroy();
          return;
        }
        chunks.push(chunk);
      }
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : undefined;
      await handleMcp(req, res, body);
    } catch {
      if (!res.headersSent) res.writeHead(400).end('Invalid request');
      else res.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY });
  server.on('upgrade', (req, socket, head) => {
    // Only explicitly configured browser origins may attach renderers. No URL tokens.
    if (
      req.url !== '/bridge' ||
      !req.headers.origin ||
      !browserOrigins.includes(req.headers.origin) ||
      !validRequestSource(req, browserOrigins)
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(req, socket, head, ws =>
      sockets.emit('connection', ws),
    );
  });
  sockets.on('connection', ws => {
    let id: string | undefined;
    const authTimer = setTimeout(
      () => ws.close(1008, 'Authentication required'),
      3000,
    );
    ws.on('message', raw => {
      try {
        const message = ClientMessageSchema.parse(JSON.parse(raw.toString()));
        if (!id) {
          if (message.type !== 'hello' || !tokenMatches(message.token, token)) {
            ws.close(1008, 'Unauthorized');
            return;
          }
          clearTimeout(authTimer);
          id = registry.attach('chrome', message.state, request =>
            ws.send(JSON.stringify({ type: 'command', request })),
          );
          ws.send(JSON.stringify({ type: 'connected', sessionId: id }));
        } else if (message.type === 'state') registry.update(id, message.state);
        else if (message.type === 'reply') registry.reply(id, message.reply);
        else ws.close(1008, 'Unexpected message');
      } catch {
        ws.close(1008, 'Invalid message');
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (id) registry.detach(id);
    });
    ws.on('error', () => ws.close());
  });
  // Bound dead-tab lifetime even when the browser disappears without closing TCP.
  const alive = new WeakSet<WebSocket>();
  sockets.on('connection', ws => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
  });
  const heartbeat = setInterval(() => {
    for (const ws of sockets.clients) {
      if (!alive.has(ws)) ws.terminate();
      else {
        alive.delete(ws);
        ws.ping();
      }
    }
  }, 15_000);
  heartbeat.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    clearInterval(heartbeat);
    await handler.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing MCP address');
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    registry,
    async close() {
      clearInterval(heartbeat);
      registry.close();
      for (const ws of sockets.clients) ws.terminate();
      sockets.close();
      await handler.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      );
    },
  };
}
