import { ChordType } from 'tonal';

// Define all possible keys (using just major scales for now)
export const possibleKeys = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
].map(note => `${note} major`);

export interface ChordTypeGroup {
  label: string;
  value: string[];
}

// Get all available chord types from Tonal
const allChordTypes = ChordType.all().map(ct => ct.aliases[0]);

export const chordTypeGroups: ChordTypeGroup[] = [
  {
    label: 'Simple Triads',
    value: ['maj', 'min'],
  },
  {
    label: 'Seventh Chords',
    value: ['7', 'maj7', 'min7', 'dim7'],
  },
  {
    label: 'Extended Chords',
    value: ['9', '11', '13', 'maj9', 'min9'],
  },
  {
    label: 'Suspended Chords',
    value: ['sus2', 'sus4'],
  },
  {
    label: 'Augmented & Diminished',
    value: ['aug', 'dim'],
  },
  {
    label: 'Everything',
    value: allChordTypes,
  },
];

// Compute the active chord types from the selected groups
export const getActiveChordTypes = (selectedChordGroups: ChordTypeGroup[]) => {
  // Flatten all selected groups' values and remove duplicates
  const uniqueChordTypes = new Set(
    selectedChordGroups.flatMap(group => group.value),
  );
  return Array.from(uniqueChordTypes);
};
