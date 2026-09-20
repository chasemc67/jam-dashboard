import { randomUUID } from 'node:crypto';
import type {
  AppState,
  Command,
  CommandReply,
  CommandRequest,
  SessionInfo,
  ToolHost,
} from '../../shared/agent/contract';
import { AppStateSchema, CommandReplySchema } from '../../shared/agent/wire';
import { ToolError } from '../../shared/music/theory';

type Session = {
  id: string;
  platform: SessionInfo['platform'];
  state: AppState;
  send: (request: CommandRequest) => void;
  pending?: {
    id: string;
    resolve: (state: AppState) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
};

/** Holds reported state only. The renderer validates and commits every mutation. */
export class SessionRegistry implements ToolHost {
  private sessions = new Map<string, Session>();
  constructor(private timeoutMs = 10_000) {}

  attach(
    platform: SessionInfo['platform'],
    state: AppState,
    send: Session['send'],
  ) {
    if (this.sessions.size >= 16)
      throw new ToolError(
        'SESSION_LIMIT',
        'Too many connected dashboard sessions.',
      );
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      platform,
      state: AppStateSchema.parse(state),
      send,
    });
    return id;
  }
  update(id: string, state: AppState) {
    const session = this.resolve(id);
    const validated = AppStateSchema.parse(state);
    if (validated.revision >= session.state.revision) session.state = validated;
  }
  detach(id: string) {
    const session = this.sessions.get(id);
    if (session?.pending) {
      clearTimeout(session.pending.timer);
      session.pending.reject(
        new ToolError(
          'SESSION_DISCONNECTED',
          'The app disconnected before acknowledging the change. Reconnect and read its state before retrying.',
        ),
      );
    }
    this.sessions.delete(id);
  }
  listSessions(): SessionInfo[] {
    return [...this.sessions.values()].map(s => ({
      id: s.id,
      platform: s.platform,
      title: `Jam Dashboard (${s.platform})`,
      revision: s.state.revision,
      viewReady: s.state.viewReady,
    }));
  }
  private resolve(id?: string): Session {
    if (!id && this.sessions.size > 1)
      throw new ToolError(
        'SESSION_REQUIRED',
        'Multiple app sessions are connected. Use list_sessions and specify sessionId.',
      );
    const session = id
      ? this.sessions.get(id)
      : this.sessions.values().next().value;
    if (!session)
      throw new ToolError(
        'SESSION_DISCONNECTED',
        'No matching app session is connected. Open Jam Dashboard and enable the agent connection.',
      );
    return session;
  }
  getState(id?: string) {
    return this.resolve(id).state;
  }
  execute(
    command: Command,
    id?: string,
    expectedRevision?: number,
  ): Promise<AppState> {
    const session = this.resolve(id);
    if (session.pending)
      throw new ToolError(
        'SESSION_BUSY',
        'Another command is awaiting a render. Wait for its result before retrying.',
      );
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();
      const timer = setTimeout(() => {
        session.pending = undefined;
        reject(
          new ToolError(
            'ACK_TIMEOUT',
            'The app did not acknowledge the command. It may have applied it. Read get_state before retrying.',
          ),
        );
      }, this.timeoutMs);
      session.pending = { id: requestId, resolve, reject, timer };
      try {
        session.send({ id: requestId, command, expectedRevision });
      } catch (error) {
        clearTimeout(timer);
        session.pending = undefined;
        reject(error);
      }
    });
  }
  reply(id: string, raw: CommandReply) {
    const session = this.resolve(id);
    const reply = CommandReplySchema.parse(raw);
    const pending = session.pending;
    if (!pending || pending.id !== reply.id) return;
    clearTimeout(pending.timer);
    session.pending = undefined;
    if (reply.error)
      pending.reject(new ToolError(reply.error.code, reply.error.message));
    else if (reply.state) {
      this.update(id, reply.state);
      pending.resolve(session.state);
    } else
      pending.reject(
        new ToolError('INVALID_REPLY', 'The app returned no rendered state.'),
      );
  }
  close() {
    for (const id of this.sessions.keys()) this.detach(id);
  }
}
