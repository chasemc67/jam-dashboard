import { useId, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import AgentChatPanel from './AgentChatPanel';

export default function AgentChat({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent-chat' }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 ml-[3.25rem]">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label="Agent chat"
            title="Agent chat"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onInteractOutside={event => event.preventDefault()}
          onFocusOutside={event => event.preventDefault()}
          className="flex h-[min(28rem,var(--radix-popover-content-available-height))] max-h-[min(38rem,var(--radix-popover-content-available-height))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl p-0 shadow-xl [@media(max-height:500px)]:block [@media(max-height:500px)]:h-auto [@media(max-height:500px)]:overflow-y-auto"
        >
          <AgentChatPanel
            titleId={titleId}
            descriptionId={descriptionId}
            messages={messages}
            status={status}
            error={error}
            input={input}
            onInputChange={setInput}
            onSubmit={() => {
              const text = input.trim();
              if (!text || (status !== 'ready' && status !== 'error')) return;
              void sendMessage({ text });
              setInput('');
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
