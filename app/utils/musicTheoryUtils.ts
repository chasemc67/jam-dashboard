const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const all_notes = [
  `Cb`,
  'C',
  'C#',
  `Db`,
  'D',
  'D#',
  `Eb`,
  'E',
  'F',
  'F#',
  `Gb`,
  'G',
  'G#',
  `Ab`,
  'A',
  'A#',
  `Bb`,
  'B',
];

// Map of note modifiers to their semitone offset
const modifierToOffset: { [key: string]: number } = {
  '##': 2, // double sharp
  '#': 1, // sharp
  '': 0, // natural
  b: -1, // flat
  bb: -2, // double flat
};

// Get the base note and modifier from a note string
const parseNote = (note: string): { baseNote: string; modifier: string } => {
  const baseNote = note.charAt(0).toUpperCase();
  const modifier = note.substring(1);
  return { baseNote, modifier };
};

// Convert a note to its numeric position (0-11)
const getNotePosition = (note: string): number => {
  const { baseNote, modifier } = parseNote(note);
  const baseIndex = notes.findIndex(n => n.charAt(0) === baseNote);
  const offset = modifierToOffset[modifier] || 0;
  return (baseIndex + offset + 12) % 12;
};

// Check if two notes are equivalent (represent the same pitch)
const areNotesEquivalent = (note1: string, note2: string): boolean => {
  return getNotePosition(note1) === getNotePosition(note2);
};

const getNoteAtFret = (rootNote: string, fretNumber: number): string => {
  const rootPosition = getNotePosition(rootNote);
  const newPosition = (rootPosition + fretNumber) % 12;
  return notes[newPosition];
};

const PITCH_CLASSES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/**
 * Takes an array of note names (e.g. ["C","E","G","B"]) and
 * returns them with octaves assigned. If a note's pitch class
 * is lower or equal to the previous note's pitch class, we bump
 * the octave by 1.
 *
 * Example:
 *   addOctavesToChordNotes(['C','E','G','B']) => ['C4','E4','G4','B4']
 *
 * @param notes       Array of note names (e.g. "C", "F#", etc.).
 * @param startOctave Octave for the first note (default = 4).
 */
export function addOctavesToChordNotes(
  notes: string[],
  startOctave = 4,
): string[] {
  if (notes.length === 0) {
    return [];
  }

  const result: string[] = [];
  let currentOctave = startOctave;
  let prevPitchClass: number | null = null;

  notes.forEach((note, index) => {
    const pitchClass = PITCH_CLASSES[note];
    if (pitchClass === undefined) {
      throw new Error(`Unknown note name: ${note}`);
    }

    if (index === 0) {
      // first note just uses startOctave
      result.push(`${note}${currentOctave}`);
    } else {
      // if next pitch class <= previous, we bump the octave
      if (pitchClass <= (prevPitchClass as number)) {
        currentOctave++;
      }
      result.push(`${note}${currentOctave}`);
    }

    prevPitchClass = pitchClass;
  });

  return result;
}

export { getNoteAtFret, areNotesEquivalent };
