import type {
  AppController,
  AppState,
  CommandReply,
  CommandRequest,
  ConnectionInfo,
} from '../../shared/agent/contract';
import { CommandRequestSchema } from '../../shared/agent/wire';
import { serializeError } from '../../shared/agent/tools';

export interface DesktopAgentAPI {
  copyConfiguration(): Promise<void>;
  getConnection(): Promise<{ connection?: ConnectionInfo; error?: string }>;
  connect(state: AppState): Promise<string>;
  disconnect(id: string): Promise<void>;
  publish(id: string, state: AppState): Promise<void>;
  reply(id: string, reply: CommandReply): Promise<void>;
  onCommand(callback: (request: CommandRequest) => void): () => void;
}
export type BridgeStatus = {
  connected: boolean;
  message: string;
  sessionId?: string;
};

export async function executeRequest(
  controller: AppController,
  raw: CommandRequest,
): Promise<CommandReply> {
  try {
    const request = CommandRequestSchema.parse(raw);
    return {
      id: request.id,
      state: await controller.execute(
        request.command,
        request.expectedRevision,
      ),
    };
  } catch (error) {
    return { id: raw.id, error: serializeError(error) };
  }
}

/** Keep retries of a delivered request from applying a second time. New sessions get a fresh cache. */
export function requestHandler(controller: AppController) {
  const recent = new Map<
    string,
    { input: string; reply: Promise<CommandReply> }
  >();
  return (request: CommandRequest): Promise<CommandReply> => {
    const input = JSON.stringify(request);
    const previous = recent.get(request.id);
    if (previous)
      return previous.input === input
        ? previous.reply
        : Promise.resolve({
            id: request.id,
            error: {
              code: 'REQUEST_ID_REUSED',
              message:
                'This request ID was already used for a different command.',
            },
          });
    const reply = executeRequest(controller, request);
    recent.set(request.id, { input, reply });
    if (recent.size > 100) recent.delete(recent.keys().next().value!);
    return reply;
  };
}

export function connectBrowser(
  controller: AppController,
  connection: ConnectionInfo,
  report: (status: BridgeStatus) => void,
) {
  let disposed = false;
  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let delay = 500;
  let connected = false;
  const handleRequest = requestHandler(controller);
  const url = new URL(connection.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')
    throw new Error('The agent bridge must run on 127.0.0.1.');
  url.protocol = 'ws:';
  url.pathname = '/bridge';
  function open() {
    if (disposed) return;
    const socket = new WebSocket(url);
    ws = socket;
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: 'hello',
          token: connection.token,
          state: controller.read(),
        }),
      );
    socket.onmessage = async event => {
      if (disposed) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'connected') {
          connected = true;
          delay = 500;
          report({
            connected: true,
            message: 'Connected',
            sessionId: message.sessionId,
          });
          socket.send(
            JSON.stringify({ type: 'state', state: controller.read() }),
          );
        } else if (message.type === 'command' && connected) {
          const reply = await handleRequest(message.request);
          if (socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: 'reply', reply }));
        }
      } catch {
        socket.close(1008, 'Invalid command');
      }
    };
    socket.onclose = event => {
      connected = false;
      if (disposed) return;
      if (event.code === 1008) {
        report({
          connected: false,
          message: 'Connection rejected. Restart the local app and reconnect.',
        });
        return;
      }
      report({
        connected: false,
        message: 'Reconnecting to the local service…',
      });
      retry = setTimeout(open, delay);
      delay = Math.min(delay * 2, 5000);
    };
    socket.onerror = () => socket.close();
  }
  const unsubscribe = controller.subscribe(state => {
    if (connected && ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'state', state }));
  });
  open();
  return () => {
    disposed = true;
    clearTimeout(retry);
    unsubscribe();
    ws?.close();
  };
}

export function connectDesktop(
  controller: AppController,
  api: DesktopAgentAPI,
  report: (status: BridgeStatus) => void,
) {
  let disposed = false;
  let id: string | undefined;
  const handleRequest = requestHandler(controller);
  const fail = (error: unknown) => {
    if (!disposed)
      report({
        connected: false,
        message:
          error instanceof Error ? error.message : 'Desktop connection failed.',
      });
  };
  const unsubscribeCommand = api.onCommand(request => {
    if (id)
      void handleRequest(request)
        .then(reply => {
          if (id) return api.reply(id, reply);
        })
        .catch(fail);
  });
  const unsubscribeState = controller.subscribe(state => {
    if (id) void api.publish(id, state).catch(fail);
  });
  void api
    .connect(controller.read())
    .then(sessionId => {
      if (disposed) {
        void api.disconnect(sessionId).catch(() => {});
        return;
      }
      id = sessionId;
      report({ connected: true, message: 'Connected', sessionId });
      return api.publish(sessionId, controller.read());
    })
    .catch(fail);
  return () => {
    disposed = true;
    unsubscribeCommand();
    unsubscribeState();
    if (id) void api.disconnect(id).catch(() => {});
  };
}
