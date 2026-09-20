import type { Meta, StoryObj } from '@storybook/react';
import AiGuide from './AiGuide';

export default {
  title: 'Components/AiGuide',
  component: AiGuide,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AiGuide>;

type Story = StoryObj<typeof AiGuide>;
export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
export const Mobile: Story = {
  args: { defaultOpen: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
