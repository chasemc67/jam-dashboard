import { chordTypesCurated } from '~/utils/chordTypesCurated';

export interface ChordTypeGroup {
  label: string;
  value: string[];
}
0;
export const INDIVIDUAL_NOTES = 'Individual Notes';

// Get all available chord types from Tonal
const allChordTypes = chordTypesCurated;

export const chordTypeGroups: ChordTypeGroup[] = [
  // For individual notes, we'll treat them as a special case
  {
    label: INDIVIDUAL_NOTES,
    value: [],
  },
  {
    label: 'Simple Triads',
    value: ['maj', 'min'],
  },
  {
    label: 'Seventh Chords',
    value: ['7', 'maj7', 'm7', 'dim7'],
  },
  {
    label: 'Extended Chords',
    value: ['5', '9', 'maj9', 'm9'],
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
