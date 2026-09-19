import { useEffect, useState } from 'react';
import { useAgent } from '~/contexts/AgentContext';
import {
  connectBrowser,
  connectDesktop,
  type BridgeStatus,
} from '~/agent/bridge';
import { registerWebMcp, type ModelContext } from '~/agent/webmcp';
import type { ConnectionInfo } from '../../../shared/agent/contract';
import { Button } from '~/components/ui/button';

export default function AgentConnection() {
  const { controller } = useAgent();
  const [enabled, setEnabled] = useState(true);
  const [connection, setConnection] = useState<ConnectionInfo>();
  const [status, setStatus] = useState<BridgeStatus>({
    connected: false,
    message: 'Connecting…',
  });
  const [showToken, setShowToken] = useState(false);
  const [webMcp, setWebMcp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    if (!enabled) {
      setStatus({ connected: false, message: 'Disconnected' });
      return;
    }
    let disposed = false;
    let disconnect: (() => void) | undefined;
    async function start() {
      const desktop = window.jamAgent;
      const response = desktop
        ? await desktop.getConnection()
        : await fetch('/__jam-agent/config', { cache: 'no-store' }).then(
            async r => {
              if (!r.ok)
                throw new Error(
                  'Start the local agent app with npm run agent:dev.',
                );
              return r.json() as Promise<{
                connection?: ConnectionInfo;
                error?: string;
              }>;
            },
          );
      if (disposed) return;
      if (!response.connection)
        throw new Error(response.error ?? 'Agent service unavailable.');
      setConnection(response.connection);
      disconnect = desktop
        ? connectDesktop(controller, desktop, setStatus)
        : connectBrowser(controller, response.connection, setStatus);
    }
    void start().catch(error => {
      if (!disposed) setStatus({ connected: false, message: error.message });
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [controller, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const modelContext = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (!modelContext) return;
    let disposed = false;
    const registration = registerWebMcp(controller, modelContext);
    void registration.ready
      .then(() => {
        if (!disposed) setWebMcp(true);
      })
      .catch(() => {
        if (!disposed) setWebMcp(false);
      });
    return () => {
      disposed = true;
      registration.dispose();
      setWebMcp(false);
    };
  }, [controller, enabled]);
  const copyConfig = async () => {
    if (!connection) return;
    const config = {
      mcpServers: {
        'jam-dashboard': {
          url: connection.url,
          headers: { Authorization: `Bearer ${connection.token}` },
        },
      },
    };
    try {
      if (window.jamAgent) await window.jamAgent.copyConfiguration();
      else await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Clipboard unavailable. Use the address and token above.');
    }
  };
  return (
    <details
      className="w-full max-w-2xl rounded-lg border px-4 py-3 text-sm"
      data-ph-mask
    >
      <summary className="cursor-pointer">
        AI connection · <span aria-live="polite">{status.message}</span>
        {webMcp ? ' · WebMCP available' : ''}
      </summary>
      <div className="mt-3 space-y-3">
        <p>
          Connect your local agent to control this fretboard and use the music
          tools.
        </p>
        {connection && (
          <>
            <label className="block">
              MCP address
              <input
                readOnly
                className="mt-1 w-full rounded border bg-background p-2"
                value={connection.url}
              />
            </label>
            <label className="block">
              Bearer token
              <input
                readOnly
                autoComplete="off"
                type={showToken ? 'text' : 'password'}
                className="mt-1 w-full rounded border bg-background p-2"
                value={connection.token}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowToken(s => !s)}
              >
                {showToken ? 'Hide token' : 'Show token'}
              </Button>
              <Button
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
          size="sm"
          variant="outline"
          onClick={() => {
            setEnabled(e => !e);
            setCopied(false);
          }}
        >
          {enabled ? 'Disconnect this view' : 'Connect this view'}
        </Button>
      </div>
    </details>
  );
}
