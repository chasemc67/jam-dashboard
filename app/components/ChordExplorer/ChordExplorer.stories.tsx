import type { Meta, StoryObj } from '@storybook/react';
import ChordExplorer from './ChordExplorer';
import { HighlightedNotesProvider } from '~/contexts/HighlightedNotesContext';

const meta = {
  title: 'Components/ChordExplorer',
  component: ChordExplorer,
  decorators: [
    Story => (
      <HighlightedNotesProvider>
        <Story />
      </HighlightedNotesProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ChordExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
