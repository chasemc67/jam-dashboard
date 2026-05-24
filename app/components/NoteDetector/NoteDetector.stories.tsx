import type { Meta, StoryObj } from '@storybook/react';
import { NoteDetectorUI } from './NoteDetector';
import type { UseNoteDetectionReturn } from '~/hooks/useNoteDetection';
import '~/tailwind.css';

const baseMock: UseNoteDetectionReturn = {
  status: 'idle',
  error: null,
  hasPermission: true,
  devices: [
    { deviceId: 'dev1', label: 'Focusrite Scarlett 2i2', kind: 'audioinput', groupId: 'g1', toJSON: () => ({}) },
    { deviceId: 'dev2', label: 'Built-in Microphone', kind: 'audioinput', groupId: 'g2', toJSON: () => ({}) },
  ] as MediaDeviceInfo[],
  selectedDeviceId: 'dev1',
  setSelectedDeviceId: () => {},
  currentNote: null,
  noteLog: [],
  requestPermission: async () => {},
  start: async () => {},
  stop: () => {},
  clearLog: () => {},
  refreshDevices: async () => {},
};

const meta: Meta<typeof NoteDetectorUI> = {
  title: 'Components/NoteDetector',
  component: NoteDetectorUI,
};

export default meta;
type Story = StoryObj<typeof NoteDetectorUI>;

export const Idle: Story = {
  args: {
    detection: { ...baseMock },
  },
};

export const Listening: Story = {
  args: {
    detection: {
      ...baseMock,
      status: 'listening',
      currentNote: 'E',
      noteLog: ['E', 'A', 'D', 'G', 'B', 'E'],
    },
  },
};

export const WithManyNotes: Story = {
  args: {
    detection: {
      ...baseMock,
      status: 'listening',
      currentNote: 'G',
      noteLog: ['C', 'E', 'G', 'C', 'E', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    },
  },
};

export const Error: Story = {
  args: {
    detection: {
      ...baseMock,
      status: 'error',
      error: 'Microphone permission denied. Please allow access and try again.',
    },
  },
};

export const NoDevices: Story = {
  args: {
    detection: {
      ...baseMock,
      devices: [],
      selectedDeviceId: null,
    },
  },
};

export const NoPermission: Story = {
  args: {
    detection: {
      ...baseMock,
      hasPermission: false,
      devices: [],
      selectedDeviceId: null,
    },
  },
};
