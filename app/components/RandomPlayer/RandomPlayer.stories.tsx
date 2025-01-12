import { Meta, StoryFn } from '@storybook/react';
import RandomPlayer from './RandomPlayer';
import '~/tailwind.css';

export default {
  title: 'Components/RandomPlayer',
  component: RandomPlayer,
} as Meta<typeof RandomPlayer>;

const Template: StoryFn = () => <RandomPlayer />;

export const Default = Template.bind({});
Default.args = {};
