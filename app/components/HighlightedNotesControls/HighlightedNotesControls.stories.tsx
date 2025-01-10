// HighlightedNotesControls.stories.tsx
import React, { useState } from 'react';
import { Meta, Story } from '@storybook/react';
import HighlightedNotesControls, {
  HighlightedNotesControlsProps,
} from './HighlightedNotesControls';

export default {
  title: 'Components/HighlightedNotesControls',
  component: HighlightedNotesControls,
} as Meta;

const Template: Story<HighlightedNotesControlsProps> = args => {
  const [highlightedNotes, setHighlightedNotes] = useState([
    { note: 'C', color: 'grey' },
    { note: 'D', color: 'grey' },
    { note: 'E', color: 'grey' },
    { note: 'F', color: 'grey' },
    { note: 'G', color: 'grey' },
    { note: 'A', color: 'grey' },
    { note: 'B', color: 'grey' },
  ]);

  return (
    <HighlightedNotesControls
      {...args}
      highlightedNotes={highlightedNotes}
      setHighlightedNotes={setHighlightedNotes}
    />
  );
};

export const Default = Template.bind({});
Default.args = {};
