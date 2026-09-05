import type { Meta, StoryObj } from '@storybook/react';
import DesktopAnalyzer from './DesktopAnalyzer';

const meta = {
  title: 'Components/DesktopAnalyzer',
  component: DesktopAnalyzer,
} satisfies Meta<typeof DesktopAnalyzer>;

export default meta;
type Story = StoryObj<typeof meta>;

// In a browser, clicking explains that the installed Mac app is required.
export const Default: Story = {};
