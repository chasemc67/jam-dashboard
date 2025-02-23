import type { Meta, StoryObj } from '@storybook/react';
import ChordExplorer from './ChordExplorer';
import { HighlightProvider } from '~/contexts/HighlightContext';

const meta = {
  title: 'Components/ChordExplorer',
  component: ChordExplorer,
  decorators: [
    Story => (
      <HighlightProvider>
        <Story />
      </HighlightProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ChordExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
