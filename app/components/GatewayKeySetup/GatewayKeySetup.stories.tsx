import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_KEYCHAIN_ACCOUNT,
  GATEWAY_KEYCHAIN_SERVICE,
  type GatewayKeyStatus,
} from '~/agent/gateway-key';
import GatewayKeySetup from './GatewayKeySetup';

const missing: GatewayKeyStatus = {
  configured: false,
  source: null,
  service: GATEWAY_KEYCHAIN_SERVICE,
  account: GATEWAY_KEYCHAIN_ACCOUNT,
};
const saved: GatewayKeyStatus = {
  ...missing,
  configured: true,
  source: 'keychain',
};

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[32rem] w-[25rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
      {children}
    </div>
  );
}

export default {
  title: 'Components/GatewayKeySetup',
  component: GatewayKeySetup,
  decorators: [
    Story => (
      <div className="dark bg-background p-6 text-foreground">
        <PanelFrame>
          <Story />
        </PanelFrame>
      </div>
    ),
  ],
  args: {
    titleId: 'gateway-key-title',
    descriptionId: 'gateway-key-description',
    status: missing,
    onSave: async () => ({ ok: true, status: saved }),
    onClear: async () => ({ ok: true, status: missing }),
    onClose: () => {},
  },
} satisfies Meta<typeof GatewayKeySetup>;

type Story = StoryObj<typeof GatewayKeySetup>;

export const MissingKey: Story = {};
export const SavedKey: Story = {
  args: { status: saved, onBack: () => {} },
};
export const RejectedKey: Story = {
  args: {
    status: saved,
    notice: GATEWAY_KEY_REJECTED_MESSAGE,
    onBack: () => {},
  },
};
export const EnvironmentOverride: Story = {
  args: { status: { ...saved, source: 'environment' }, onBack: () => {} },
};
export const KeychainError: Story = {
  args: {
    status: {
      ...missing,
      error:
        'Keychain could not read the key: User interaction is not allowed.',
    },
  },
};
