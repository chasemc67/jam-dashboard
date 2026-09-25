import { fireEvent, render, screen } from '@testing-library/react';
import { ContextProviders } from '../ContextProviders';
import AgentConnection, {
  AgentConnectionProvider,
  useAgentConnectionModel,
} from './AgentConnection';

afterEach(() => {
  delete window.jamAgent;
});

function Panel() {
  const model = useAgentConnectionModel();
  if (!model) return null;
  return (
    <AgentConnection
      model={model}
      titleId="mcp-title"
      descriptionId="mcp-description"
      onBack={() => {}}
      onClose={() => {}}
    />
  );
}

test.each([false, true])(
  'desktop config copy uses the trusted API and keeps connection status (failure=%s)',
  async fail => {
    const copy = jest.fn(async () => {
      if (fail) throw new Error('Clipboard unavailable');
    });
    window.jamAgent = {
      getConnection: async () => ({
        connection: { url: 'http://127.0.0.1:4177/mcp', token: 'test-token' },
      }),
      connect: async () => 'test-session',
      disconnect: async () => {},
      publish: async () => {},
      reply: async () => {},
      onCommand: () => () => {},
      copyConfiguration: copy,
    };
    render(
      <ContextProviders>
        <AgentConnectionProvider>
          <Panel />
        </AgentConnectionProvider>
      </ContextProviders>,
    );
    expect(
      screen.getByRole('heading', { name: 'MCP connection' }),
    ).toBeInTheDocument();
    await screen.findByText('Connected');
    expect(screen.getByLabelText('MCP address')).toHaveValue(
      'http://127.0.0.1:4177/mcp',
    );
    expect(screen.getByLabelText('Bearer token')).toHaveAttribute(
      'type',
      'password',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show token' }));
    expect(screen.getByLabelText('Bearer token')).toHaveAttribute(
      'type',
      'text',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy Cursor MCP config' }),
    );
    if (fail) await screen.findByRole('alert');
    else await screen.findByRole('button', { name: 'Copied' });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Disconnect this view' }),
    );
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Connect this view' }),
    ).toBeInTheDocument();
  },
);
