// ChordSelectionControls.stories.tsx
import { Meta, StoryFn } from '@storybook/react';
import ChordSelectionControls, {
  ChordSelectionControlsProps,
} from './ChordSelectionControls';

export default {
  title: 'Components/ChordSelectionControls',
  component: ChordSelectionControls,
} as Meta<typeof ChordSelectionControls>;

const Template: StoryFn<ChordSelectionControlsProps> = (
  args: ChordSelectionControlsProps,
) => {
  return <ChordSelectionControls {...args} />;
};

export const Default = Template.bind({});
Default.args = {
  selectedKey: 'C major',
  onKeyChange: () => {},
  selectedChordGroups: [
    {
      label: 'Simple Triads',
      value: ['maj', 'min'],
    },
    {
      label: 'Seventh Chords',
      value: ['7', 'maj7', 'min7', 'dim7'],
    },
  ],
  onChordGroupsChange: () => {},
};

export const AllChordTypes = Template.bind({});
AllChordTypes.args = {
  selectedKey: 'G major',
  onKeyChange: () => {},
  selectedChordGroups: [
    {
      label: 'Everything',
      value: [
        'maj',
        'min',
        '7',
        'maj7',
        'min7',
        'dim7',
        '9',
        '11',
        '13',
        'maj9',
        'min9',
        'sus2',
        'sus4',
        'aug',
        'dim',
      ],
    },
  ],
  onChordGroupsChange: () => {},
};
