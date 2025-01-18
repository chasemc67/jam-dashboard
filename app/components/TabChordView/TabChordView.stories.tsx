import type { Meta, StoryObj } from '@storybook/react';
import TabChordView from './TabChordView';

const meta = {
  title: 'Components/TabChordView',
  component: TabChordView,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TabChordView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
