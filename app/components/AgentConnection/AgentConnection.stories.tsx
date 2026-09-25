import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { AgentConnectionModel } from '~/hooks/useAgentConnection';
import AgentConnection from './AgentConnection';

const token = 'a1b2c3d4'.repeat(8);

function model(
  overrides: Partial<AgentConnectionModel> = {},
): AgentConnectionModel {
  return {
    enabled: true,
    toggleEnabled: () => {},
    connection: {
      url: 'http://127.0.0.1:4177/mcp',
      token,
    },
    status: {
      connected: true,
      message: 'Connected',
      sessionId: 'session-1',
    },
    webMcp: false,
    showToken: false,
    setShowToken: () => {},
    copied: false,
    copyError: '',
    copyConfig: async () => {},
    ...overrides,
  };
}

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[32rem] w-[25rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
      {children}
    </div>
  );
}

export default {
  title: 'Components/AgentConnection',
  component: AgentConnection,
  decorators: [
    Story => (
      <div className="dark bg-background p-6 text-foreground">
        <PanelFrame>
          <Story />
        </PanelFrame>
      </div>
    ),
  ],
} satisfies Meta<typeof AgentConnection>;

type Story = StoryObj<typeof AgentConnection>;

const chrome = {
  titleId: 'mcp-connection-title',
  descriptionId: 'mcp-connection-description',
  onBack: () => {},
  onClose: () => {},
};

export const Connected: Story = {
  args: { ...chrome, model: model() },
};

export const TokenVisible: Story = {
  args: {
    ...chrome,
    model: model({ showToken: true, webMcp: true }),
  },
};

export const Connecting: Story = {
  args: {
    ...chrome,
    model: model({
      connection: undefined,
      status: { connected: false, message: 'Connecting…' },
    }),
  },
};

export const Unavailable: Story = {
  args: {
    ...chrome,
    model: model({
      connection: undefined,
      status: {
        connected: false,
        message: 'Start the local agent app with npm run agent:dev.',
      },
    }),
  },
};
