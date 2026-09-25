import { fireEvent, render, screen } from '@testing-library/react';
import type { AgentChatVoice } from '~/hooks/useAgentChatVoice';
import AgentChatPanel from './AgentChatPanel';

const idleVoice = (
  overrides: Partial<AgentChatVoice> = {},
): AgentChatVoice => ({
  status: 'idle',
  error: null,
  devices: [
    { deviceId: 'chat-mic', label: 'USB headset mic' },
    { deviceId: 'guitar-mic', label: 'Focusrite Scarlett 2i2' },
  ],
  selectedDeviceId: 'chat-mic',
  hasPermission: true,
  level: 0,
  supported: true,
  mode: 'dictation',
  onModeChange: jest.fn(),
  jevTranscript: [],
  jevEvaluating: false,
  onSelectDevice: jest.fn(),
  onStart: jest.fn(),
  onStop: jest.fn(async () => 'draft'),
  onCancel: jest.fn(),
  onRefreshDevices: jest.fn(),
  ...overrides,
});

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

test('voice composer lists an independent mic and starts dictation', () => {
  const voice = idleVoice();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input=""
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
      voice={voice}
    />,
  );
  expect(screen.getByLabelText('Chat microphone')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
  expect(voice.onStart).toHaveBeenCalledTimes(1);
});

test('recording keeps the dictated draft visible in the composer', () => {
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input="Show me B major and then"
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
      voice={idleVoice({ status: 'recording', level: 0.6 })}
    />,
  );
  const textbox = screen.getByRole('textbox', { name: 'Message' });
  expect(textbox).toHaveValue('Show me B major and then');
  expect(textbox).toHaveAttribute('readonly');
  expect(screen.getByRole('status', { name: 'Listening' })).toBeInTheDocument();
});

test('stopping the mic does not submit the message', () => {
  const voice = idleVoice({ status: 'recording', level: 0.6 });
  const onSubmit = jest.fn();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input="Show D dorian"
      onInputChange={jest.fn()}
      onSubmit={onSubmit}
      onClose={jest.fn()}
      voice={voice}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));
  expect(voice.onStop).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(voice.onCancel).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('Send while dictating is an explicit submit', () => {
  const voice = idleVoice({ status: 'recording' });
  const onSubmit = jest.fn();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input=""
      onInputChange={jest.fn()}
      onSubmit={onSubmit}
      onClose={jest.fn()}
      voice={voice}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(voice.onStop).not.toHaveBeenCalled();
});

test('empty composer does not submit', () => {
  const onSubmit = jest.fn();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input="   "
      onInputChange={jest.fn()}
      onSubmit={onSubmit}
      onClose={jest.fn()}
      voice={idleVoice()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  fireEvent.submit(
    screen.getByRole('textbox', { name: 'Message' }).closest('form')!,
  );
  expect(onSubmit).not.toHaveBeenCalled();
});

test('shows voice permission and STT errors', () => {
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input=""
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
      voice={idleVoice({
        status: 'error',
        error:
          'Microphone permission denied. Allow access in the browser to use voice mode.',
        hasPermission: false,
        devices: [],
        selectedDeviceId: null,
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('permission denied');
});

test('desktop chat offers key settings and a replace action for key errors', () => {
  const onManageKey = jest.fn();
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      description="Runs on this Mac with your AI Gateway key."
      messages={[]}
      status="error"
      error={
        new Error(
          JSON.stringify({
            error:
              'The AI Gateway rejected your API key. Replace the key and try again.',
          }),
        )
      }
      input=""
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
      onManageKey={onManageKey}
    />,
  );
  expect(
    screen.getByText('Runs on this Mac with your AI Gateway key.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('rejected your API key');
  fireEvent.click(screen.getByRole('button', { name: 'Replace key' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI Gateway key' }));
  expect(onManageKey).toHaveBeenCalledTimes(2);
});

test('web chat has no key settings', () => {
  render(
    <AgentChatPanel
      titleId="title"
      descriptionId="description"
      messages={[]}
      status="ready"
      input=""
      onInputChange={jest.fn()}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(
    screen.queryByRole('button', { name: 'AI Gateway key' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('npm run agent:dev')).toBeInTheDocument();
});
