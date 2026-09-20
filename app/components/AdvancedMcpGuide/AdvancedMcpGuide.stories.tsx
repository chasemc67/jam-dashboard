import type { Meta, StoryObj } from '@storybook/react';
import AdvancedMcpGuide from './AdvancedMcpGuide';

export default {
  title: 'Components/AdvancedMcpGuide',
  component: AdvancedMcpGuide,
  decorators: [
    Story => (
      <div className="max-w-lg p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdvancedMcpGuide>;

export const Default: StoryObj<typeof AdvancedMcpGuide> = {};
