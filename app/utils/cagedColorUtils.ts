import { CAGEDShape } from './cagedShapeUtils';
import { areNotesEquivalent } from './musicTheoryUtils';

// CAGED shape colors
export const CAGED_COLORS: Record<CAGEDShape, string> = {
  C: 'red',
  A: 'blue',
  G: 'green',
  E: 'yellow',
  D: 'orange',
};

export const getCagedNoteColor = (
  note: string,
  stringNumber: number,
  cagedShape: CAGEDShape,
  scaleNotes: string[],
  pentatonicNotes: string[],
  getNotesForStringInShape: (
    stringNumber: number,
    shape: CAGEDShape,
  ) => [number, number],
): string | undefined => {
  // Check if the note is in the scale
  const isInScale = scaleNotes.some(scaleNote =>
    areNotesEquivalent(scaleNote, note),
  );

  if (!isInScale) {
    return undefined;
  }

  // Get the pentatonic positions for this string in the current shape
  const [firstPentatonicIndex, secondPentatonicIndex] =
    getNotesForStringInShape(stringNumber, cagedShape);
  const shapePentatonicNotes = [
    pentatonicNotes[firstPentatonicIndex],
    pentatonicNotes[secondPentatonicIndex],
  ];

  // Check if the note is part of the CAGED shape
  const isInShape = shapePentatonicNotes.some(pentatonicNote =>
    areNotesEquivalent(pentatonicNote, note),
  );

  return isInShape ? CAGED_COLORS[cagedShape] : 'grey';
};
