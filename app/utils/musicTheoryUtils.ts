const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

export { getNoteAtFret, areNotesEquivalent };
