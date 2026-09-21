import { fireEvent, render, screen } from '@testing-library/react';
import AgentChatPanel from './AgentChatPanel';

test('renders messages, tool indicators, and sends on Enter', () => {
  const onSubmit = jest.fn();
  const onInputChange = jest.fn();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Show B major.' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-set_view',
              state: 'output-available',
            },
            {
              type: 'text',
              text: 'Showing B major.',
            },
          ],
        },
      ]}
      status="ready"
      input="Show D dorian"
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByText('Show B major.')).toBeInTheDocument();
  expect(screen.getByText('Used set_view')).toBeInTheDocument();
  expect(screen.getByText('Showing B major.')).toBeInTheDocument();
  const form = screen.getByRole('textbox', { name: 'Message' }).closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
    target: { value: 'Show C major' },
  });
  expect(onInputChange).toHaveBeenCalledWith('Show C major');
});

test('shows a connection error and thinking status', () => {
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="submitted"
      error={
        new Error(
          'Jam MCP is not running. Start the local app with `npm run agent:dev` so chat can control the fretboard.',
        )
      }
      input=""
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
  expect(screen.getByRole('alert')).toHaveTextContent('npm run agent:dev');
});
