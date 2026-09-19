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

  numberOfFrets: 12,
  startingFret: 0,
  showTextNotes: true,
  isLeftHanded: true,
};
