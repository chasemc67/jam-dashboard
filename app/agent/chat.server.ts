import { createMCPClient } from '@ai-sdk/mcp';
import {
  createAgentUIStreamResponse,
  ToolLoopAgent,
  type createGateway,
} from 'ai';
import {
  JAM_CHAT_INSTRUCTIONS,
  jamMcpErrorMessage,
  prepareAgentChatRequest,
} from './chat-config';

async function closeQuietly(close: () => Promise<void>) {
  try {
    await close();
  } catch {
    // The client may already be closed after a transport error.
  }
}

export async function handleAgentChatRequest(
  request: Request,
  deps: {
    env?: Record<string, string | undefined>;
    /** Omit to use the default AI Gateway provider configured from process env. */
    gateway?: Pick<ReturnType<typeof createGateway>, 'languageModel'>;
  } = {},
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Request body must be JSON.', { status: 400 });
  }

  const prepared = prepareAgentChatRequest(body, deps.env);
  if (!prepared.ok) {
    return new Response(prepared.error, { status: prepared.status });
  }

  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined;
  try {
    mcpClient = await createMCPClient({
      clientName: 'jam-dashboard-chat',
      transport: {
        type: 'http',
        url: prepared.connection.url,
        headers: {
          Authorization: `Bearer ${prepared.connection.token}`,
        },
      },
    });
    const tools = await mcpClient.tools();
    const client = mcpClient;
    const agent = new ToolLoopAgent({
      model: deps.gateway
        ? deps.gateway.languageModel(prepared.model)
        : prepared.model,
      instructions: JAM_CHAT_INSTRUCTIONS,
      tools,
    });
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: prepared.messages,
      abortSignal: request.signal,
      onError: error => jamMcpErrorMessage(error),
      onEnd: async () => {
        await closeQuietly(() => client.close());
      },
    });
  } catch (error) {
    if (mcpClient) {
      const client = mcpClient;
      await closeQuietly(() => client.close());
    }
    return new Response(jamMcpErrorMessage(error), { status: 503 });
  }
}
