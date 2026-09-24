import { createGateway } from 'ai';
import { handleAgentChatRequest } from '../../app/agent/chat.server';
import { handleAgentTranscribeRequest } from '../../app/agent/voice.server';
import { MCP_UNAVAILABLE_MESSAGE } from '../../app/agent/chat-config';
import {
  DESKTOP_AGENT_REQUEST_HEADER,
  GATEWAY_KEY_MISSING_MESSAGE,
} from '../../app/agent/gateway-key';
import type { ConnectionInfo } from '../../shared/agent/contract';

const ROUTES = {
  '/api/agent-chat': 'chat',
  '/api/agent-transcribe': 'transcribe',
} as const;

type Env = Record<string, string | undefined>;
type Gateway = ReturnType<typeof createGateway>;

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function isDesktopAgentApiURL(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'jam:' &&
      url.host === 'dashboard' &&
      url.pathname.startsWith('/api/')
    );
  } catch {
    return false;
  }
}

/**
 * Serves Agent chat and voice for the packaged app from the Electron main process. The
 * Gateway key is read per request and passed to an explicit provider, so it never enters
 * process.env (inherited by helper processes) or the renderer.
 */
export function createDesktopAgentApi({
  getGatewayKey,
  getMcpConnection,
  env = process.env,
  chat = handleAgentChatRequest,
  transcribe = handleAgentTranscribeRequest,
  createProvider = apiKey => createGateway({ apiKey }),
}: {
  getGatewayKey: () => Promise<string | null>;
  getMcpConnection: () => ConnectionInfo | undefined;
  env?: Env;
  chat?: typeof handleAgentChatRequest;
  transcribe?: typeof handleAgentTranscribeRequest;
  createProvider?: (apiKey: string) => Gateway;
}) {
  return async function handle(request: Request): Promise<Response> {
    const route = isDesktopAgentApiURL(request.url)
      ? ROUTES[new URL(request.url).pathname as keyof typeof ROUTES]
      : undefined;
    if (!route) return new Response('Not found', { status: 404 });
    if (request.method !== 'POST')
      return new Response('Method not allowed', { status: 405 });
    // Electron doesn't forward Origin to protocol handlers. A custom header forces a CORS
    // preflight, which the jam: scheme never grants, so only the app's own pages get here.
    if (request.headers.get(DESKTOP_AGENT_REQUEST_HEADER) !== '1')
      return new Response('Forbidden', { status: 403 });
    const connection = getMcpConnection();
    if (!connection) return jsonError(MCP_UNAVAILABLE_MESSAGE, 503);
    let key: string | null;
    try {
      key = await getGatewayKey();
    } catch (error) {
      return jsonError((error as Error).message, 503);
    }
    if (!key) return jsonError(GATEWAY_KEY_MISSING_MESSAGE, 401);
    const requestEnv: Env = {
      AI_GATEWAY_API_KEY: key,
      JAM_AGENT_URL: connection.url,
      JAM_AGENT_TOKEN: connection.token,
      JAM_AGENT_CHAT_MODEL: env.JAM_AGENT_CHAT_MODEL,
      JAM_AGENT_TRANSCRIBE_MODEL: env.JAM_AGENT_TRANSCRIBE_MODEL,
    };
    const gateway = createProvider(key);
    return route === 'chat'
      ? chat(request, { env: requestEnv, gateway })
      : transcribe(request, { env: requestEnv, gateway });
  };
}
