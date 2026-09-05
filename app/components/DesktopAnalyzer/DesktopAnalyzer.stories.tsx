import type { Meta, StoryObj } from '@storybook/react';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';
import DesktopAnalyzer, { DesktopAnalyzerTrigger } from './DesktopAnalyzer';

const meta = {
  title: 'Components/DesktopAnalyzer',
  component: DesktopAnalyzer,
  decorators: [
    Story => (
      <ScaleKeyProvider>
        <DesktopAnalyzerTrigger />
        <Story />
      </ScaleKeyProvider>
    ),
  ],
} satisfies Meta<typeof DesktopAnalyzer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
