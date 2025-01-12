// Fret.stories.tsx
import React from 'react';
import { Story, Meta } from '@storybook/react/types-6-0';
import Fret, { FretProps } from './Fret_backup';

export default {
  title: 'Components/Fret_backup',
  component: Fret,
} as Meta;

const Template: Story<FretProps> = args => <Fret {...args} />;

export const Default = Template.bind({});
Default.args = {
  fretNumber: 1,
  highlightedNotes: [
    { note: 'C', color: 'blue' },
    { note: 'E', color: 'red' },
  ],
  rootNotes: ['E', 'A', 'D', 'G', 'B', 'E'],
  showTextNotes: true,
};
