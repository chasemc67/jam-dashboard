// get every chord that fits a scale
import { Scale, Chord, Note } from 'tonal';
import { chordTypesCurated } from './chordTypesCurated';

export const getEveryNoteInScale = (scaleName: string) => {
  return Scale.get(scaleName).notes;
};

export const getEveryChordInScale = (
  scaleName: string,
  customChordTypes?: string[],
) => {
  const scale = Scale.get(scaleName).notes; // ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] for D major

  // Function to normalize note names for comparison
  const normalizeNote = (note: string) => Note.simplify(note);

  // Function to check if a chord fits within the scale
  const isChordInScale = (chordNotes: string[], scaleNotes: string[]) => {
    const normalizedScaleNotes = scaleNotes.map(normalizeNote);
    return chordNotes.every((note: string) =>
      normalizedScaleNotes.includes(normalizeNote(note)),
    );
  };

  // Use custom chord types if provided, otherwise get all available chord types
  const chordTypes = customChordTypes || chordTypesCurated; // Use first alias for names

  // Find valid chords for each note in the scale
  const chordsByNote = scale.map(note => {
    const validChords = chordTypes
      .map(type => {
        const chord = Chord.getChord(type, note); // Build chord for each type
        if (chord.empty) return null; // Skip invalid chords
        const isValid = isChordInScale(chord.notes, scale); // Check if all notes fit in scale
        return isValid ? `${note}${type}` : null; // Return chord name if valid
      })
      .filter(Boolean); // Remove nulls

    return { note, chords: validChords };
  });

  return chordsByNote;
};
