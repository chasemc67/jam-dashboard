import {
  CAGEDShape,
  CAGEDShapeSelection,
  getNotesForStringInShape,
  getShapesForNoteOnString,
} from './cagedShapeUtils';
import { areNotesEquivalent } from './musicTheoryUtils';

// CAGED shape colors
export const CAGED_COLORS: Record<CAGEDShape, string> = {
  C: 'red',
  A: 'blue',
  G: 'green',
  E: 'yellow',
  D: 'orange',
};

// Scale notes that are not part of the highlighted shape(s), e.g. the 4th and 7th
export const CAGED_NON_SHAPE_COLOR = 'grey';

/**
 * Colors for a note under CAGED coloring.
 * - `undefined`: the note should not be drawn
 * - one color: draw the note solid in that color
 * - two colors: the note belongs to two shapes; colors are ordered from the
 *   nut side to the bridge side of the neck (callers should reverse this for a
 *   left-handed fretboard, where the nut is on the right)
 */
export type CagedNoteColors = [string] | [string, string];

export const getCagedNoteColors = (
  note: string,
  stringNumber: number,
  cagedShape: CAGEDShapeSelection,
  scaleNotes: string[],
  pentatonicNotes: string[],
): CagedNoteColors | undefined => {
  const isInScale = scaleNotes.some(scaleNote =>
    areNotesEquivalent(scaleNote, note),
  );
  if (!isInScale) {
    return undefined;
  }

  const pentatonicIndex = pentatonicNotes.findIndex(pentatonicNote =>
    areNotesEquivalent(pentatonicNote, note),
  );
  if (pentatonicIndex === -1) {
    return [CAGED_NON_SHAPE_COLOR];
  }

  if (cagedShape === 'ALL') {
    const { lower, higher } = getShapesForNoteOnString(
      stringNumber,
      pentatonicIndex,
    );
    return [CAGED_COLORS[lower], CAGED_COLORS[higher]];
  }

  const isInShape = getNotesForStringInShape(stringNumber, cagedShape).includes(
    pentatonicIndex,
  );

  return isInShape ? [CAGED_COLORS[cagedShape]] : [CAGED_NON_SHAPE_COLOR];
};

/**
 * Orients nut-to-bridge ordered colors to left-to-right screen order.
 */
export const orientCagedColors = (
  colors: CagedNoteColors,
  isLeftHanded: boolean,
): CagedNoteColors => {
  if (colors.length === 2 && isLeftHanded) {
    return [colors[1], colors[0]];
  }
  return colors;
};
