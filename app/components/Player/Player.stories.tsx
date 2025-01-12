import { Meta, StoryFn } from '@storybook/react';
import Player, { PlayerProps } from './Player';

export default {
  title: 'Components/Player',
  component: Player,
} as Meta;

const Template: StoryFn<PlayerProps> = args => <Player {...args} />;

export const Default = Template.bind({});
Default.args = {
  notes: ['C4', 'E4', 'G4'], // C major triad
};

export const MinorChord = Template.bind({});
MinorChord.args = {
  notes: ['A3', 'C4', 'E4'], // A minor triad
};

export const SeventhChord = Template.bind({});
SeventhChord.args = {
  notes: ['G3', 'B3', 'D4', 'F4'], // G7 chord
};
