import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { AgentChatVoice } from '~/hooks/useAgentChatVoice';
import AgentChat from './AgentChat';
import AgentChatPanel from './AgentChatPanel';

const idleVoice: AgentChatVoice = {
  status: 'idle',
  error: null,
  devices: [
    { deviceId: 'chat-mic', label: 'USB headset mic' },
    { deviceId: 'guitar-mic', label: 'Focusrite Scarlett 2i2' },
  ],
  selectedDeviceId: 'chat-mic',
  hasPermission: true,
  level: 0.15,
  supported: true,
  onSelectDevice: () => {},
  onStart: () => {},
  onStop: async () => null,
  onCancel: () => {},
  onRefreshDevices: () => {},
};

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[32rem] w-[25rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
      {children}
    </div>
  );
}

export default {
  title: 'Components/AgentChat',
  component: AgentChat,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="dark min-h-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentChat>;

type Story = StoryObj<typeof AgentChat>;
export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
export const Mobile: Story = {
  args: { defaultOpen: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const WithMessages: StoryObj<typeof AgentChatPanel> = {
  render: () => (
    <PanelFrame>
      <AgentChatPanel
        titleId="agent-chat-title"
        descriptionId="agent-chat-description"
        messages={[
          {
            id: 'user-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Show B major on the fretboard.' }],
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
                type: 'tool-show_fretboard',
                state: 'input-available',
              },
              {
                type: 'text',
                text: 'B major is selected. The fretboard is showing that scale.',
              },
            ],
          },
        ]}
        status="streaming"
        input=""
        onInputChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
        voice={idleVoice}
      />
    </PanelFrame>
  ),
};

export const VoiceListening: StoryObj<typeof AgentChatPanel> = {
  render: () => (
    <PanelFrame>
      <AgentChatPanel
        titleId="agent-chat-title"
        descriptionId="agent-chat-description"
        messages={[]}
        status="ready"
        input="Show me B major and then highlight the"
        onInputChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
        voice={{ ...idleVoice, status: 'recording', level: 0.7 }}
      />
    </PanelFrame>
  ),
};

export const VoiceListeningEmpty: StoryObj<typeof AgentChatPanel> = {
  render: () => (
    <PanelFrame>
      <AgentChatPanel
        titleId="agent-chat-title"
        descriptionId="agent-chat-description"
        messages={[]}
        status="ready"
        input=""
        onInputChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
        voice={{ ...idleVoice, status: 'recording', level: 0.4 }}
      />
    </PanelFrame>
  ),
};

export const VoiceTranscribing: StoryObj<typeof AgentChatPanel> = {
  render: () => (
    <PanelFrame>
      <AgentChatPanel
        titleId="agent-chat-title"
        descriptionId="agent-chat-description"
        messages={[]}
        status="ready"
        input="Show me B major and then highlight the major third"
        onInputChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
        voice={{ ...idleVoice, status: 'transcribing' }}
      />
    </PanelFrame>
  ),
};

export const VoiceError: StoryObj<typeof AgentChatPanel> = {
  render: () => (
    <PanelFrame>
      <AgentChatPanel
        titleId="agent-chat-title"
        descriptionId="agent-chat-description"
        messages={[]}
        status="ready"
        input=""
        onInputChange={() => {}}
        onSubmit={() => {}}
        onClose={() => {}}
        voice={{
          ...idleVoice,
          status: 'error',
          hasPermission: false,
          devices: [],
          selectedDeviceId: null,
          error:
            'Microphone permission denied. Allow access in the browser to use voice mode.',
        }}
      />
    </PanelFrame>
  ),
};
