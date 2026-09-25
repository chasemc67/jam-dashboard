import { createContext, useContext, type ReactNode } from 'react';
import { ArrowLeft, Cable, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  useAgentConnection,
  type AgentConnectionModel,
} from '~/hooks/useAgentConnection';

const AgentConnectionContext = createContext<AgentConnectionModel | null>(null);

/** Keeps the fretboard bridge connected for this route. Agent Chat only displays it. */
export function AgentConnectionProvider({ children }: { children: ReactNode }) {
  const model = useAgentConnection();
  return (
    <AgentConnectionContext.Provider value={model}>
      {children}
    </AgentConnectionContext.Provider>
  );
}

export function useAgentConnectionModel() {
  return useContext(AgentConnectionContext);
}

export function McpConnectionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="rounded-full"
      aria-label="MCP connection"
      title="MCP connection"
      onClick={onClick}
    >
      <Cable aria-hidden="true" />
    </Button>
  );
}

export default function AgentConnection({
  model,
  titleId,
  descriptionId,
  onBack,
  onClose,
}: {
  model: AgentConnectionModel;
  titleId: string;
  descriptionId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const {
    enabled,
    toggleEnabled,
    connection,
    status,
    webMcp,
    showToken,
    setShowToken,
    copied,
    copyError,
    copyConfig,
  } = model;
  const addressId = `${titleId}-mcp-address`;
  const tokenId = `${titleId}-mcp-token`;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col [@media(max-height:500px)]:block"
      data-ph-mask
    >
      <div className="shrink-0 border-b px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1">
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
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <Cable className="h-3.5 w-3.5" aria-hidden="true" />
                Agent setup
              </div>
              <h2 id={titleId} className="text-lg font-semibold">
                MCP connection
              </h2>
            </div>
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
          Connect your local agent to control this fretboard and use the music
          tools.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-sm [@media(max-height:500px)]:overflow-visible">
        <p role="status" aria-live="polite">
          {status.message}
          {webMcp ? ' · WebMCP available' : ''}
        </p>
        {connection && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={addressId}>MCP address</Label>
              <Input
                id={addressId}
                readOnly
                spellCheck={false}
                className="font-mono text-xs"
                value={connection.url}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={tokenId}>Bearer token</Label>
              <Input
                id={tokenId}
                readOnly
                autoComplete="off"
                spellCheck={false}
                type={showToken ? 'text' : 'password'}
                className="font-mono text-xs"
                value={connection.token}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowToken(value => !value)}
              >
                {showToken ? 'Hide token' : 'Show token'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyConfig()}
              >
                {copied ? 'Copied' : 'Copy Cursor MCP config'}
              </Button>
            </div>
            {copyError && <p role="alert">{copyError}</p>}
            <p className="text-xs text-muted-foreground">
              For Codex, add this URL to your MCP settings and use a bearer
              token environment variable. Connection instructions are in
              docs/agent-tools.md.
            </p>
          </>
        )}
        {status.sessionId && (
          <p className="text-xs text-muted-foreground">
            Session: {status.sessionId}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={toggleEnabled}
        >
          {enabled ? 'Disconnect this view' : 'Connect this view'}
        </Button>
      </div>
    </div>
  );
}
