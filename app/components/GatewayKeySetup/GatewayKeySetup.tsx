import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  X,
} from 'lucide-react';
import { McpConnectionButton } from '~/components/AgentConnection';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  AI_GATEWAY_AUTH_DOCS_URL,
  AI_GATEWAY_KEYS_URL,
  GATEWAY_KEYCHAIN_ACCOUNT,
  GATEWAY_KEYCHAIN_SERVICE,
  normalizeGatewayKey,
  type GatewayKeyResult,
  type GatewayKeyStatus,
} from '~/agent/gateway-key';

export default function GatewayKeySetup({
  titleId,
  descriptionId,
  status,
  notice,
  onSave,
  onClear,
  onBack,
  onOpenConnection,
  onClose,
}: {
  titleId: string;
  descriptionId: string;
  status: GatewayKeyStatus | null;
  /** Shown above the steps, e.g. when the Gateway rejected the saved key. */
  notice?: string | null;
  onSave: (key: string) => Promise<GatewayKeyResult>;
  onClear: () => Promise<GatewayKeyResult>;
  /** Present when the user opened this panel from chat and can return to it. */
  onBack?: () => void;
  /** Opens MCP address, token, and connect/disconnect controls. */
  onOpenConnection?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const configured = Boolean(status?.configured);
  const fromKeychain = configured && status?.source === 'keychain';
  const service = status?.service ?? GATEWAY_KEYCHAIN_SERVICE;
  const account = status?.account ?? GATEWAY_KEYCHAIN_ACCOUNT;

  async function run(action: () => Promise<GatewayKeyResult>, done: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) setMessage(done);
      else setError(result.error);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not update the key.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col [@media(max-height:500px)]:block">
      <div className="shrink-0 border-b px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1">
            {onBack && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="-ml-2 -mt-1 h-8 w-8 shrink-0 rounded-full"
                aria-label="Back to chat"
                onClick={onBack}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            )}
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Agent setup
              </div>
              <h2 id={titleId} className="text-lg font-semibold">
                {configured ? 'AI Gateway key' : 'Add your AI Gateway key'}
              </h2>
            </div>
          </div>
          <div className="-mr-2 -mt-2 flex shrink-0 gap-1">
            {onOpenConnection && (
              <McpConnectionButton onClick={onOpenConnection} />
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
          Agent chat and voice run on this Mac with your own Vercel AI Gateway
          key. It is stored securely in your macOS Keychain, not in the app.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-sm [@media(max-height:500px)]:overflow-visible">
        {notice && (
          <p role="alert" className="text-destructive">
            {notice}
          </p>
        )}
        {status?.error && (
          <p role="alert" className="text-destructive">
            {status.error}
          </p>
        )}
        {configured && (
          <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>
              {fromKeychain
                ? 'A key is saved in your Keychain. Paste a new one to replace it.'
                : 'Using AI_GATEWAY_API_KEY from the environment (development). Keys saved here are used when it is unset.'}
            </p>
          </div>
        )}
        <ol className="list-decimal space-y-3 pl-5 marker:text-muted-foreground">
          <li>
            <span className="font-medium">Get a key.</span> If someone shared
            Jam Dashboard with you, use the personal key they sent. Otherwise
            create one in Vercel under AI Gateway → API keys.
            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <a
                href={AI_GATEWAY_KEYS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                Open AI Gateway keys
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href={AI_GATEWAY_AUTH_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                How keys work
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </span>
          </li>
          <li>
            <span className="font-medium">Paste it once</span> and save. Jam
            Dashboard reads it from Keychain for each request; the key is never
            shown again.
          </li>
          <li>
            <span className="font-medium">Replace or remove it later</span> from
            the key button in Agent chat.
          </li>
        </ol>
        <form
          className="space-y-2"
          onSubmit={event => {
            event.preventDefault();
            const normalized = normalizeGatewayKey(value);
            if (!normalized.ok) {
              setError(normalized.error);
              setMessage(null);
              return;
            }
            setValue('');
            void run(
              () => onSave(normalized.key),
              'Key saved to Keychain. Agent chat is ready.',
            );
          }}
        >
          <Label htmlFor={`${titleId}-key`}>AI Gateway API key</Label>
          <div className="flex gap-2">
            <Input
              id={`${titleId}-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="vck_…"
              value={value}
              disabled={busy}
              onChange={event => setValue(event.target.value)}
            />
            <Button type="submit" disabled={busy || !value.trim()}>
              {fromKeychain ? 'Replace' : 'Save'}
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-muted-foreground">
            {message}
          </p>
        )}
        {fromKeychain && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run(onClear, 'Key removed from Keychain.')}
          >
            Remove key from Keychain
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Keychain item: service “{service}”, account “{account}”. You can also
          view or delete it in Keychain Access.
        </p>
      </div>
    </div>
  );
}
