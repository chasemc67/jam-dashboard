import type { Meta, StoryObj } from '@storybook/react';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';
import DesktopAnalyzer from './DesktopAnalyzer';

const meta = {
  title: 'Components/DesktopAnalyzer',
  component: DesktopAnalyzer,
  decorators: [
    Story => (
      <ScaleKeyProvider>
        <Story />
      </ScaleKeyProvider>
    ),
  ],
} satisfies Meta<typeof DesktopAnalyzer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
