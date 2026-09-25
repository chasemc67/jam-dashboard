export type AgentChatPart = {
  type: string;
  text?: string;
  state?: string;
  toolName?: string;
};

export type AgentChatMessage = {
  id: string;
  role: string;
  parts: AgentChatPart[];
  metadata?: unknown;
};

/** Metadata on user messages that Jev mode sent automatically. */
export const JEV_MESSAGE_METADATA = { source: 'jev' } as const;

export function isJevChatMessage(message: AgentChatMessage) {
  const metadata = message.metadata;
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    (metadata as { source?: unknown }).source === JEV_MESSAGE_METADATA.source
  );
}

export type DescribedChatPart =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; label: string };

export function describeChatPart(
  part: AgentChatPart,
): DescribedChatPart | null {
  if (part.type === 'text') {
    return part.text ? { kind: 'text', text: part.text } : null;
  }
  const toolName =
    part.type === 'dynamic-tool'
      ? part.toolName
      : part.type.startsWith('tool-')
        ? part.type.slice('tool-'.length)
        : undefined;
  if (!toolName) return null;
  const pending =
    part.state === 'input-streaming' || part.state === 'input-available';
  return {
    kind: 'tool',
    label: pending ? `Using ${toolName}…` : `Used ${toolName}`,
  };
}

export function chatErrorMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message) {
    return 'The chat agent failed. Try again.';
  }
  const text = error.message.trim();
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof parsed.error === 'string'
    ) {
      return parsed.error;
    }
  } catch {
    // The transport surfaces HTTP error bodies as plain text.
  }
  return text;
}
