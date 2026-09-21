import { useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  chatErrorMessage,
  describeChatPart,
  type AgentChatMessage,
} from '~/agent/chat-ui';

export default function AgentChatPanel({
  titleId,
  descriptionId,
  messages,
  status,
  error,
  input,
  onInputChange,
  onSubmit,
  onClose,
}: {
  titleId: string;
  descriptionId: string;
  messages: AgentChatMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error?: Error;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  return (
    <div className="flex min-h-0 flex-1 flex-col [@media(max-height:500px)]:block">
      <div className="shrink-0 border-b px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Agent chat
            </div>
            <h2 id={titleId} className="text-lg font-semibold">
              Ask Jam Dashboard
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-mr-2 -mt-2 shrink-0 rounded-full"
            aria-label="Close agent chat"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          Ask to change the key, highlight notes, or find voicings. This chat
          uses the local MCP server from <code>npm run agent:dev</code>.
        </p>
      </div>
      <div
        ref={listRef}
        aria-label="Chat messages"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [@media(max-height:500px)]:overflow-visible"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Try “Show B major on the fretboard.”
          </p>
        )}
        <div className="space-y-3">
          {messages.map(message => (
            <article key={message.id} className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </p>
              {message.parts.map((part, index) => {
                const described = describeChatPart(part);
                if (!described) return null;
                if (described.kind === 'tool') {
                  return (
                    <p
                      key={`${message.id}-tool-${index}`}
                      className="text-xs text-muted-foreground"
                    >
                      {described.label}
                    </p>
                  );
                }
                return (
                  <p
                    key={`${message.id}-text-${index}`}
                    className="whitespace-pre-wrap text-sm leading-relaxed"
                  >
                    {described.text}
                  </p>
                );
              })}
            </article>
          ))}
          {status === 'submitted' && (
            <p role="status" className="text-sm text-muted-foreground">
              Thinking…
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {chatErrorMessage(error)}
          </p>
        )}
      </div>
      <form
        className="shrink-0 border-t bg-muted/30 p-3"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={event => onInputChange(event.target.value)}
            placeholder="Ask to show a key or voicing…"
            aria-label="Message"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
