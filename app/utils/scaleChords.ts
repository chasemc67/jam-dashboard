// get every chord that fits a scale
import { Scale, Chord, ChordType } from 'tonal';

export const getEveryChordInScale = (
  scaleName: string,
  customChordTypes?: string[],
) => {
  const scale = Scale.get(scaleName).notes; // ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] for D major

  // Function to check if a chord fits within the scale
  const isChordInScale = (chordNotes: string[], scaleNotes: string[]) => {
    return chordNotes.every((note: string) => scaleNotes.includes(note)); // All chord notes must be in scale
  };

  // Use custom chord types if provided, otherwise get all available chord types
  const chordTypes =
    customChordTypes || ChordType.all().map(ct => ct.aliases[0]); // Use first alias for names

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
