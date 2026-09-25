import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import GatewayKeySetup from '~/components/GatewayKeySetup';
import { chatErrorMessage, JEV_MESSAGE_METADATA } from '~/agent/chat-ui';
import {
  DESKTOP_AGENT_REQUEST_HEADER,
  GATEWAY_KEY_REJECTED_MESSAGE,
  isGatewayKeyError,
} from '~/agent/gateway-key';
import { useAgentChatVoice } from '~/hooks/useAgentChatVoice';
import { useGatewayKey } from '~/hooks/useGatewayKey';
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
  const [managingKey, setManagingKey] = useState(false);
  const gatewayKey = useGatewayKey();
  const needsKey =
    gatewayKey.required &&
    gatewayKey.status !== null &&
    !gatewayKey.status.configured;
  const showKeySetup = needsKey || managingKey;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agent-chat',
        headers: { [DESKTOP_AGENT_REQUEST_HEADER]: '1' },
      }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const chatReady = status === 'ready' || status === 'error';
  // Jev can hear a request while the agent is still answering; queue it and
  // send each one as a normal user message once chat is ready again.
  const [jevQueue, setJevQueue] = useState<string[]>([]);
  const [jevSendsDone, setJevSendsDone] = useState(0);
  const jevSendingRef = useRef(false);
  const voice = useAgentChatVoice({
    enabled: chatReady && !showKeySetup,
    draft: input,
    onDraftChange: setInput,
    onJevSubmit: text => setJevQueue(queue => [...queue, text]),
  });
  useEffect(() => {
    if (jevSendingRef.current || !chatReady || jevQueue.length === 0) return;
    const [text, ...rest] = jevQueue;
    jevSendingRef.current = true;
    setJevQueue(rest);
    void sendMessage({ text, metadata: JEV_MESSAGE_METADATA }).finally(() => {
      jevSendingRef.current = false;
      setJevSendsDone(count => count + 1);
    });
  }, [chatReady, jevQueue, jevSendsDone, sendMessage]);
  const sendDraft = (draft: string) => {
    const text = draft.trim();
    if (!text || !chatReady) return;
    void sendMessage({ text });
    setInput('');
  };
  const listening = voice.status === 'recording';
  const chatError = error ? chatErrorMessage(error) : null;
  const keyError = [chatError, voice.error].find(isGatewayKeyError) ?? null;
  const { refresh: refreshKey } = gatewayKey;
  useEffect(() => {
    // The key may have been removed from Keychain outside the app.
    if (keyError) void refreshKey().catch(() => {});
  }, [keyError, refreshKey]);

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 ml-[3.25rem]">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="relative h-11 w-11 rounded-full shadow-lg"
            aria-label={listening ? 'Agent chat (mic on)' : 'Agent chat'}
            title={listening ? 'Agent chat — mic is on' : 'Agent chat'}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {listening && (
              <span
                aria-hidden="true"
                className="absolute right-0.5 top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-background bg-destructive"
              />
            )}
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
          {showKeySetup ? (
            <GatewayKeySetup
              titleId={titleId}
              descriptionId={descriptionId}
              status={gatewayKey.status}
              notice={
                keyError === GATEWAY_KEY_REJECTED_MESSAGE ? keyError : null
              }
              onSave={async key => {
                const result = await gatewayKey.save(key);
                if (result.ok) {
                  clearError();
                  setManagingKey(false);
                }
                return result;
              }}
              onClear={gatewayKey.clear}
              onBack={needsKey ? undefined : () => setManagingKey(false)}
              onClose={() => setOpen(false)}
            />
          ) : (
            <AgentChatPanel
              titleId={titleId}
              descriptionId={descriptionId}
              description={
                gatewayKey.required
                  ? 'Ask to change the key, highlight notes, or find voicings. Tap the mic to talk. Runs on this Mac with your AI Gateway key and the app’s built-in MCP server.'
                  : undefined
              }
              messages={messages}
              status={status}
              error={error}
              input={input}
              onInputChange={setInput}
              onSubmit={() => {
                if (
                  voice.mode === 'dictation' &&
                  (voice.status === 'recording' ||
                    voice.status === 'transcribing')
                ) {
                  // Explicit Send while dictating: finish the transcript first.
                  void voice.onStop().then(draft => {
                    if (draft !== null) sendDraft(draft);
                  });
                  return;
                }
                sendDraft(input);
              }}
              onClose={() => setOpen(false)}
              onManageKey={
                gatewayKey.required ? () => setManagingKey(true) : undefined
              }
              voice={voice}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
