import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { JevSegmentOutcome } from '~/agent/jev-filter';
import { buildJevTranscriptLines } from '~/agent/jev-transcript';
import JevTranscript from './JevTranscript';

const segments = [
  { index: 0, text: 'The television is still playing.', final: true },
  {
    index: 1,
    text: 'We already ate dinner. Could you show B major on the fretboard?',
    final: true,
  },
  { index: 2, text: 'Maybe later or perhaps tomorrow.', final: true },
  { index: 3, text: 'Highlight the major third for me.', final: true },
  { index: 4, text: 'Okay so what time is practice', final: false },
];

const outcomes = new Map<number, JevSegmentOutcome>([
  [0, { status: 'held', reason: 'ambient' }],
  [
    1,
    {
      status: 'sent',
      startWord: 4,
      text: 'Could you show B major on the fretboard?',
      at: 0,
    },
  ],
  [2, { status: 'held', reason: 'ambient' }],
  [3, { status: 'held', reason: 'unclear' }],
]);

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[32rem] w-[25rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
      {children}
    </div>
  );
}

export default {
  title: 'Components/JevTranscript',
  component: JevTranscript,
  decorators: [
    Story => (
      <div className="dark bg-background p-6 text-foreground">
        <PanelFrame>
          <Story />
        </PanelFrame>
      </div>
    ),
  ],
  args: {
    onBack: () => {},
    onUseText: () => {},
  },
} satisfies Meta<typeof JevTranscript>;

type Story = StoryObj<typeof JevTranscript>;

export const Live: Story = {
  args: {
    live: true,
    evaluating: true,
    lines: buildJevTranscriptLines(segments, outcomes, { live: true }),
  },
};

export const AfterSession: Story = {
  args: {
    live: false,
    lines: buildJevTranscriptLines(segments, outcomes, { live: false }),
  },
};

export const Empty: Story = {
  args: { live: true, lines: [] },
};
