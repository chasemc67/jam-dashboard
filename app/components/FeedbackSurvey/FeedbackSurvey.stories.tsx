import type { Meta, StoryObj } from '@storybook/react';
import FeedbackSurvey from './FeedbackSurvey';

const meta = {
  title: 'Components/FeedbackSurvey',
  component: FeedbackSurvey,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FeedbackSurvey>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
