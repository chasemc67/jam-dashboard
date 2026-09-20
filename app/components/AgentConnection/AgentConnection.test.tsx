import { fireEvent, render, screen } from '@testing-library/react';
import { ContextProviders } from '../ContextProviders';
import AgentConnection from './AgentConnection';

afterEach(() => {
  delete window.jamAgent;
});

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
        <AgentConnection />
      </ContextProviders>,
    );
    fireEvent.click(screen.getByText(/AI connection/));
    await screen.findByText('Connected');
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy Cursor MCP config' }),
    );
    if (fail) await screen.findByRole('alert');
    else await screen.findByRole('button', { name: 'Copied' });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  },
);
