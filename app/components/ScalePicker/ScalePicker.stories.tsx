import { Meta, StoryObj } from '@storybook/react';

import { ScalePicker } from './ScalePicker';

const meta: Meta<typeof ScalePicker> = {
  title: 'Example/ScalePicker',
  component: ScalePicker,
};

export default meta;

type Story = StoryObj<typeof ScalePicker>;

export const Default: Story = {
  args: {
    // Any props you might want to pass in to ScalePicker
  },
};
