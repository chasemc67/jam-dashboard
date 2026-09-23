export const MCP_UNAVAILABLE_MESSAGE =
  'Jam MCP is not running. Start the local app with `npm run agent:dev` so chat can control the fretboard.';

export const GATEWAY_UNAVAILABLE_MESSAGE =
  'Set AI_GATEWAY_API_KEY in your environment (see .env.example) to use in-app chat.';

export const DEFAULT_AGENT_CHAT_MODEL = 'openai/gpt-5.4-mini';

export const JAM_CHAT_INSTRUCTIONS = `You are the in-app assistant for Jam Dashboard, a guitar music-theory tool.

Use the connected Jam Dashboard MCP tools to inspect and change the live fretboard. Prefer taking action with tools over only explaining.

Workflow:
1. Call list_sessions. If none are connected, tell the user to keep this page open, run \`npm run agent:dev\`, and leave AI connection enabled.
2. Read get_state (and get_capabilities when you need limits or the suggested workflow).
3. Select a compatible scale with set_view before showing notes or voicings. Displayed notes must belong to the selected scale.
4. Use show_fretboard, show_voicings, select_voicing, or set_view to update the visible board.
5. Theory tools (get_scale, get_chord, identify_chord, find_voicings) work without a connected view.

Rules:
- String 1 is the high/top string. Tuning and voicing arrays run high to low.
- Do not claim to play audio, run ear training, or use note detection; those are not MCP tools.
- Song analysis is desktop-only. If tools return ANALYZER_UNAVAILABLE, say so.
- After changing the view, briefly confirm what is now shown.
- Be concise, like a knowledgeable guitar teacher.`;

const LOOPBACK_MCP = /^https?:\/\/127\.0\.0\.1:\d+\/mcp$/;
const AGENT_TOKEN = /^[a-f0-9]{64}$/;

type Env = Record<string, string | undefined>;

export function resolveAgentChatModel(env: Env = process.env) {
  return env.JAM_AGENT_CHAT_MODEL?.trim() || DEFAULT_AGENT_CHAT_MODEL;
}

export function hasAiGatewayCredentials(env: Env = process.env) {
  return Boolean(
    env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim(),
  );
}

export function resolveJamMcpConnection(env: Env = process.env) {
  const url = env.JAM_AGENT_URL?.trim();
  const token = env.JAM_AGENT_TOKEN?.trim();
  if (!url || !token || !LOOPBACK_MCP.test(url) || !AGENT_TOKEN.test(token)) {
    return { ok: false as const, error: MCP_UNAVAILABLE_MESSAGE };
  }
  return { ok: true as const, url, token };
}

export function jamMcpErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|Failed to fetch|network|401|403|404|timeout|MCP|unauthorized/i.test(
      text,
    )
  ) {
    return MCP_UNAVAILABLE_MESSAGE;
  }
  return text || MCP_UNAVAILABLE_MESSAGE;
}

export function prepareAgentChatRequest(body: unknown, env: Env = process.env) {
  if (
    body === null ||
    typeof body !== 'object' ||
    !Array.isArray((body as { messages?: unknown }).messages)
  ) {
    return {
      ok: false as const,
      status: 400,
      error: 'Request must include a messages array.',
    };
  }
  if (!hasAiGatewayCredentials(env)) {
    return {
      ok: false as const,
      status: 503,
      error: GATEWAY_UNAVAILABLE_MESSAGE,
    };
  }
  const connection = resolveJamMcpConnection(env);
  if (!connection.ok) {
    return { ok: false as const, status: 503, error: connection.error };
  }
  return {
    ok: true as const,
    messages: (body as { messages: unknown[] }).messages,
    connection,
    model: resolveAgentChatModel(env),
  };
}
