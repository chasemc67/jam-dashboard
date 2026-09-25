import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyRound,
  Mic,
  RefreshCw,
  ScrollText,
  Sparkles,
  X,
} from 'lucide-react';
import { McpConnectionButton } from '~/components/AgentConnection';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import JevTranscript from '~/components/JevTranscript';
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
  isJevChatMessage,
  type AgentChatMessage,
} from '~/agent/chat-ui';
import { VOICE_UNSUPPORTED_MESSAGE } from '~/agent/voice-config';
import { appendDictation } from '~/agent/voice-dictation';
import { isGatewayKeyError } from '~/agent/gateway-key';
import type { VoiceMode } from '~/agent/voice-mic';
import type { AgentChatVoice } from '~/hooks/useAgentChatVoice';

function VoiceMeter({ level, label }: { level: number; label?: string }) {
  const weights = [0.45, 0.75, 1, 0.68, 0.5];
  return (
    <div
      className="flex h-9 min-w-0 flex-1 items-center justify-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5"
      role="status"
      aria-label="Listening"
    >
      <span className="flex h-full items-end gap-1">
        {weights.map((weight, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-primary transition-[height] duration-75"
            style={{
              height: `${Math.max(18, Math.min(100, level * weight * 160 + 18))}%`,
            }}
          />
        ))}
      </span>
      {label && (
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

const VOICE_MODES: { mode: VoiceMode; label: string; title: string }[] = [
  {
    mode: 'dictation',
    label: 'Dictation',
    title: 'Dictation: speech fills the message box; you press Send.',
  },
  {
    mode: 'jev',
    label: 'Jev',
    title:
      'Jev mode: the mic stays on and only speech meant for the assistant is sent automatically.',
  },
];

function VoiceModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: VoiceMode;
  disabled: boolean;
  onChange: (mode: VoiceMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Voice mode"
      className="flex h-8 shrink-0 rounded-md border bg-background p-0.5"
    >
      {VOICE_MODES.map(option => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          title={option.title}
          disabled={disabled}
          onClick={() => onChange(option.mode)}
          className={cn(
            'rounded px-2 text-xs font-medium transition-colors disabled:opacity-50',
            mode === option.mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
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
  onOpenConnection,
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
  /** Opens MCP address, token, and connect/disconnect controls. */
  onOpenConnection?: () => void;
  voice?: AgentChatVoice;
}) {
  const errorText = error ? chatErrorMessage(error) : null;
  const keyError =
    onManageKey &&
    (isGatewayKeyError(errorText) || isGatewayKeyError(voice?.error));
  const listRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const busy = status === 'submitted' || status === 'streaming';
  const recording = voice?.status === 'recording';
  const transcribing = voice?.status === 'transcribing';
  const requesting = voice?.status === 'requesting';
  const voiceActive = recording || transcribing || requesting;
  const jevMode = voice?.mode === 'jev';
  const dictating = voiceActive && !jevMode;
  const canSend =
    !busy &&
    !requesting &&
    (dictating
      ? recording || transcribing || Boolean(input.trim())
      : Boolean(input.trim()));
  const jevTranscript = voice?.jevTranscript ?? [];
  const canShowTranscript =
    jevMode && (voiceActive || jevTranscript.length > 0);
  const transcriptOpen = showTranscript && canShowTranscript;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status, voice?.status, transcriptOpen]);

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
            {canShowTranscript && (
              <Button
                type="button"
                size="icon"
                variant={transcriptOpen ? 'secondary' : 'ghost'}
                className="rounded-full"
                aria-label="Full transcript"
                aria-pressed={transcriptOpen}
                title="Full Jev transcript: everything heard, with sent parts highlighted"
                onClick={() => setShowTranscript(open => !open)}
              >
                <ScrollText aria-hidden="true" />
              </Button>
            )}
            {onOpenConnection && (
              <McpConnectionButton onClick={onOpenConnection} />
            )}
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
      {transcriptOpen && voice ? (
        <JevTranscript
          lines={jevTranscript}
          live={voiceActive}
          evaluating={voice.jevEvaluating}
          onBack={() => setShowTranscript(false)}
          onUseText={text => onInputChange(appendDictation(input, text))}
        />
      ) : (
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
                  {message.role === 'user'
                    ? isJevChatMessage(message)
                      ? 'You · via Jev'
                      : 'You'
                    : 'Assistant'}
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
      )}
      <form
        className="shrink-0 border-t bg-muted/30 p-3"
        onSubmit={event => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        {voice && recording && !jevMode && (
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
        {voice && recording && jevMode && (
          <div className="mb-2 flex items-center gap-2">
            <VoiceMeter
              level={voice.level}
              label={
                voice.jevEvaluating
                  ? 'Jev is checking…'
                  : 'Jev is listening for requests'
              }
            />
            {!transcriptOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                title="Everything heard so far, with sent parts highlighted"
                onClick={() => setShowTranscript(true)}
              >
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                Transcript
              </Button>
            )}
          </div>
        )}
        {voice && !recording && (
          <div className="mb-2 flex items-center gap-2">
            <VoiceModeSwitch
              mode={voice.mode}
              disabled={voiceActive || !voice.supported}
              onChange={voice.onModeChange}
            />
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
              recording
                ? jevMode
                  ? 'Talk to the assistant, or type here…'
                  : 'Listening…'
                : 'Ask to show a key or voicing…'
            }
            aria-label="Message"
            // Dictation owns the draft while the mic is live; Jev mode never
            // writes to it, so typing stays available.
            readOnly={dictating}
            disabled={busy && !jevMode}
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
                  : jevMode
                    ? recording
                      ? 'Stop Jev listening'
                      : 'Start Jev: keep the mic on and auto-send requests meant for the assistant'
                    : recording
                      ? 'Stop dictation (keeps the text; press Send to send)'
                      : 'Dictate into the message'
              }
              disabled={
                !voice.supported ||
                transcribing ||
                requesting ||
                (busy && !recording)
              }
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
