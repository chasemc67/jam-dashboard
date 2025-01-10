import React from 'react';
import { Meta, Story } from '@storybook/react';
import FretboardControls from './FretboardControls';

export default {
  title: 'Components/FretboardControls',
  component: FretboardControls,
} as Meta;

const Template: Story = () => <FretboardControls />;

export const Default = Template.bind({});
