import { useEffect, useRef, type ReactNode } from 'react';
import { KeyRound, Mic, RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  chatErrorMessage,
  describeChatPart,
  type AgentChatMessage,
} from '~/agent/chat-ui';
import { VOICE_UNSUPPORTED_MESSAGE } from '~/agent/voice-config';
import { isGatewayKeyError } from '~/agent/gateway-key';
import type { AgentChatVoice } from '~/hooks/useAgentChatVoice';

function VoiceMeter({ level }: { level: number }) {
  const weights = [0.45, 0.75, 1, 0.68, 0.5];
  return (
    <div
      className="flex h-9 min-w-0 flex-1 items-end justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5"
      role="status"
      aria-label="Listening"
    >
      {weights.map((weight, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-primary transition-[height] duration-75"
          style={{
            height: `${Math.max(18, Math.min(100, level * weight * 160 + 18))}%`,
          }}
        />
      ))}
    </div>
  );
}

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
  onManageKey,
  voice,
  description = (
    <>
      Ask to change the key, highlight notes, or find voicings. Tap the mic to
      talk. Uses the local MCP server from <code>npm run agent:dev</code>.
    </>
  ),
}: {
  titleId: string;
  descriptionId: string;
  description?: ReactNode;
  messages: AgentChatMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error?: Error;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** Desktop only: opens AI Gateway key settings. */
  onManageKey?: () => void;
  voice?: AgentChatVoice;
}) {
  const errorText = error ? chatErrorMessage(error) : null;
  const keyError =
    onManageKey &&
    (isGatewayKeyError(errorText) || isGatewayKeyError(voice?.error));
  const listRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const recording = voice?.status === 'recording';
  const transcribing = voice?.status === 'transcribing';
  const requesting = voice?.status === 'requesting';
  const voiceActive = recording || transcribing || requesting;
  const canSend =
    !busy &&
    !requesting &&
    (recording || transcribing || Boolean(input.trim()));
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status, voice?.status]);

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
          <div className="-mr-2 -mt-2 flex shrink-0 gap-1">
            {onManageKey && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full"
                aria-label="AI Gateway key"
                title="AI Gateway key"
                onClick={onManageKey}
              >
                <KeyRound aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full"
              aria-label="Close agent chat"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <div
        ref={listRef}
        aria-label="Chat messages"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [@media(max-height:500px)]:min-h-[12rem] [@media(max-height:500px)]:overflow-visible"
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
          {transcribing && (
            <p role="status" className="text-sm text-muted-foreground">
              Finishing transcript…
            </p>
          )}
        </div>
        {errorText && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorText}
          </p>
        )}
        {voice?.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {voice.error}
          </p>
        )}
        {keyError && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onManageKey}
          >
            Replace key
          </Button>
        )}
      </div>
      <form
        className="shrink-0 border-t bg-muted/30 p-3"
        onSubmit={event => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        {voice && recording && (
          <div className="mb-2 flex items-center gap-2">
            <VoiceMeter level={voice.level} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0"
              title="Stop listening and discard the dictated text"
              onClick={voice.onCancel}
            >
              Cancel
            </Button>
          </div>
        )}
        {voice && !recording && (
          <div className="mb-2 flex items-center gap-2">
            <Select
              value={voice.selectedDeviceId ?? undefined}
              onValueChange={voice.onSelectDevice}
              disabled={voiceActive || !voice.supported}
              onOpenChange={open => {
                if (open) voice.onRefreshDevices();
              }}
            >
              <SelectTrigger
                className="h-8 flex-1 text-xs"
                aria-label="Chat microphone"
              >
                <SelectValue placeholder="Chat microphone" />
              </SelectTrigger>
              <SelectContent>
                {voice.devices.length > 0 ? (
                  voice.devices.map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled>
                    {voice.hasPermission
                      ? 'No microphones found'
                      : 'Allow microphone to list devices'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Refresh chat microphones"
              title="Refresh chat microphones"
              disabled={voiceActive || !voice.supported}
              onClick={voice.onRefreshDevices}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={event => onInputChange(event.target.value)}
            placeholder={
              recording ? 'Listening…' : 'Ask to show a key or voicing…'
            }
            aria-label="Message"
            // Dictation owns the draft while the mic is live.
            readOnly={voiceActive}
            disabled={busy}
          />
          {voice && (
            <Button
              type="button"
              size="icon"
              variant={recording ? 'destructive' : 'outline'}
              className={cn('shrink-0', recording && 'animate-pulse')}
              aria-label={recording ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={recording}
              title={
                !voice.supported
                  ? VOICE_UNSUPPORTED_MESSAGE
                  : recording
                    ? 'Stop dictation (keeps the text; press Send to send)'
                    : 'Dictate into the message'
              }
              disabled={!voice.supported || busy || transcribing || requesting}
              onClick={() => {
                if (recording) void voice.onStop();
                else voice.onStart();
              }}
            >
              <Mic aria-hidden="true" />
            </Button>
          )}
          <Button type="submit" disabled={!canSend}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
