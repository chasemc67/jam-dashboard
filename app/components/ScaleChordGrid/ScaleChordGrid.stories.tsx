import type { Meta, StoryObj } from '@storybook/react';
import { ScaleChordGrid } from './ScaleChordGrid';
import { HighlightProvider } from '~/contexts/HighlightContext';
import { SettingsProvider } from '~/contexts/SettingsContext';

const meta = {
  title: 'Components/ScaleChordGrid',
  component: ScaleChordGrid,
  decorators: [
    Story => (
      <SettingsProvider>
        <HighlightProvider>
          <Story />
        </HighlightProvider>
      </SettingsProvider>
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
      <SettingsProvider>
        <HighlightProvider>
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted-foreground">
              Key: C major (set via context)
            </div>
            <Story />
          </div>
        </HighlightProvider>
      </SettingsProvider>
    ),
  ],
  play: async () => {
    // In a real implementation, we would use the testing library to set the key
    // but for this story, we'll just show how it would look with a key set
  },
};
