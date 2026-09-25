import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useAgent } from '~/contexts/AgentContext';
import {
  connectBrowser,
  connectDesktop,
  type BridgeStatus,
} from '~/agent/bridge';
import { registerWebMcp, type ModelContext } from '~/agent/webmcp';
import type { ConnectionInfo } from '../../shared/agent/contract';

export type AgentConnectionModel = {
  enabled: boolean;
  toggleEnabled: () => void;
  connection?: ConnectionInfo;
  status: BridgeStatus;
  webMcp: boolean;
  showToken: boolean;
  setShowToken: Dispatch<SetStateAction<boolean>>;
  copied: boolean;
  copyError: string;
  copyConfig: () => Promise<void>;
};

/** Owns the fretboard MCP bridge. Keep the caller mounted; the chat panel only displays this state. */
export function useAgentConnection(): AgentConnectionModel {
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
  const toggleEnabled = () => {
    setEnabled(value => !value);
    setCopied(false);
  };
  return {
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
  };
}
