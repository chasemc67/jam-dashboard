import { Meta, StoryObj } from '@storybook/react';
import '~/tailwind.css';

import { KeyPicker } from './KeyPicker';

const meta: Meta<typeof KeyPicker> = {
  title: 'Example/KeyPicker',
  component: KeyPicker,
};

export default meta;

type Story = StoryObj<typeof KeyPicker>;

export const Default: Story = {
  args: {
    // Any props you might want to pass in to KeyPicker
  },
};
