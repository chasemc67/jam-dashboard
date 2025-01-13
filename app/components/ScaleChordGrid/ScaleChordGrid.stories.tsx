import type { Meta, StoryObj } from '@storybook/react';
import { ScaleChordGrid } from './ScaleChordGrid';
import { HighlightedNotesProvider } from '~/contexts/HighlightedNotesContext';

const meta = {
  title: 'Components/ScaleChordGrid',
  component: ScaleChordGrid,
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
} satisfies Meta<typeof ScaleChordGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onChordClick: chord => console.log(`Clicked chord: ${chord}`),
  },
};

export const WithSimpleTriads: Story = {
  args: {
    onChordClick: chord => console.log(`Clicked chord: ${chord}`),
    enabledChordTypes: ['maj', 'min'],
  },
};

export const WithSeventhChords: Story = {
  args: {
    onChordClick: chord => console.log(`Clicked chord: ${chord}`),
    enabledChordTypes: ['7', 'maj7', 'min7', 'dim7'],
  },
};

export const WithoutNoteRow: Story = {
  args: {
    onChordClick: chord => console.log(`Clicked chord: ${chord}`),
    showNoteRow: false,
  },
};

export const WithCustomKey: Story = {
  args: {
    onChordClick: chord => console.log(`Clicked chord: ${chord}`),
  },
  decorators: [
    Story => (
      <HighlightedNotesProvider>
        <div className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            Key: C major (set via context)
          </div>
          <Story />
        </div>
      </HighlightedNotesProvider>
    ),
  ],
  play: async () => {
    // In a real implementation, we would use the testing library to set the key
    // but for this story, we'll just show how it would look with a key set
  },
};
