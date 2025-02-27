import type { Meta, StoryObj } from '@storybook/react';
import HowToUse from './HowToUse';

const meta = {
  title: 'Components/HowToUse',
  component: HowToUse,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof HowToUse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
