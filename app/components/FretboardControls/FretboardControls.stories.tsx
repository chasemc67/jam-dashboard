import { Meta, StoryFn } from '@storybook/react';
import FretboardControls from './FretboardControls';

export default {
  title: 'Components/FretboardControls',
  component: FretboardControls,
} as Meta;

const Template: StoryFn = () => <FretboardControls />;

export const Default = Template.bind({});
