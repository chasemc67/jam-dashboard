import { Meta, StoryFn } from '@storybook/react';
import FretBoard, { FretBoardProps } from './FretBoard';

export default {
  title: 'Components/FretBoard',
  component: FretBoard,
} as Meta;

const Template: StoryFn<FretBoardProps> = (args: FretBoardProps) => (
  <FretBoard {...args} />
);

export const Default = Template.bind({});
Default.args = {
  rootNotes: ['E', 'A', 'D', 'G', 'B', 'E'],
  highlightedNotes: [
    { note: 'C', color: 'red' },
    { note: 'D', color: 'blue' },
    { note: 'E', color: 'green' },
    { note: 'F', color: 'yellow' },
    { note: 'G', color: 'orange' },
    { note: 'A', color: 'purple' },
    { note: 'B', color: 'pink' },
  ],
  numberOfFrets: 12,
  startingFret: 0,
  showTextNotes: true,
  isLeftHanded: true,
};
