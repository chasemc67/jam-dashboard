// Fret.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import Fret from './Fret';
import '~/tailwind.css';

const meta = {
  title: 'Components/Fret',
  component: Fret,
} satisfies Meta<typeof Fret>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    fretNumber: 1,
    highlightedNotes: [
      { note: 'C', color: 'blue' },
      { note: 'E', color: 'red' },
    ],
    rootNotes: ['E', 'A', 'D', 'G', 'B', 'E'],
    showTextNotes: true,
  },
};
