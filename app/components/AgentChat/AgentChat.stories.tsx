import type { Meta, StoryObj } from '@storybook/react';
import AgentChat from './AgentChat';
import AgentChatPanel from './AgentChatPanel';

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
    <div className="flex h-[32rem] w-[25rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
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
      />
    </div>
  ),
};
