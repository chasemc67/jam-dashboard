// Types for CAGED shapes and string positions
export type CAGEDShape = 'C' | 'A' | 'G' | 'E' | 'D';

// 'ALL' renders every shape at once, with shared notes split between the two shapes they belong to
export type CAGEDShapeSelection = CAGEDShape | 'ALL';

export const CAGED_SHAPES: CAGEDShape[] = ['C', 'A', 'G', 'E', 'D'];
export const CAGED_SHAPE_CHOICES: CAGEDShapeSelection[] = [
  ...CAGED_SHAPES,
  'ALL',
];

// Interface defining which pentatonic scale indices appear on the high E string for each shape
interface ShapeHighEConfig {
  noteIndices: [number, number]; // The indices in the pentatonic scale array that appear on high E
}

// Assuming we have an array of the notes in the pentatonic scale intervals
// [1, 2, 3, X, 5, 6, X]
// like [C, D, E, G, A]
// These numbers indicate their position in that array
// (So for C major pentatonic, A shape 3, 4) is notes G, A
// Configuration for each CAGED shape's high E string notes
const SHAPE_CONFIGS: Record<CAGEDShape, ShapeHighEConfig> = {
  C: { noteIndices: [2, 3] }, // 3rd and 5th of the pentatonic
  A: { noteIndices: [3, 4] }, // Root and 2nd of the pentatonic
  G: { noteIndices: [4, 0] }, // 5th and 6th of the pentatonic
  E: { noteIndices: [0, 1] }, // 2nd and 3rd of the pentatonic
  D: { noteIndices: [1, 2] }, // 6th and root of the pentatonic
};

/**
 * Gets the pentatonic scale indices for notes on a given string in a CAGED shape
 * @param stringNumber - The string number (1 = high E, 6 = low E)
 * @param shape - The CAGED shape to use
 * @returns Array of two numbers representing the indices in the pentatonic scale that appear on this string
 */
export function getNotesForStringInShape(
  stringNumber: number,
  shape: CAGEDShape,
): [number, number] {
  // Normalize string number to 1-6 range by taking modulo
  // We subtract 1 before modulo to handle the wrap-around correctly
  // Then add 1 back to get to 1-based string numbers
  const normalizedString = ((stringNumber - 1) % 5) + 1;

  // Get the base configuration from the high E string
  const baseConfig = SHAPE_CONFIGS[shape];

  // For the high E string (1), return the base configuration
  if (normalizedString === 1) {
    return baseConfig.noteIndices;
  }

  // For other strings, we need to walk backwards from the high E configuration
  // Each string moves back one position in the pentatonic scale for each note
  const offset = normalizedString;
  const [firstNote, secondNote] = baseConfig.noteIndices;

  // Calculate new indices with wraparound (modulo 5 since pentatonic has 5 notes)
  const newFirstNote = (firstNote + (offset - 1) * 3) % 5;
  const newSecondNote = (secondNote + (offset - 1) * 3) % 5;

  return [newFirstNote, newSecondNote];
}

/**
 * Finds the two CAGED shapes that share a given pentatonic note on a string.
 * Within a shape, the first note on a string sits at the lower fret and the second
 * at the higher fret, so a note is the "top" of one shape and the "bottom" of the next.
 * @param stringNumber - The string number (1 = high E, 6 = low E)
 * @param pentatonicIndex - Index of the note in the pentatonic scale array (0-4)
 * @returns lower: the shape that extends toward the nut from this note,
 *          higher: the shape that extends toward the bridge from this note
 */
export function getShapesForNoteOnString(
  stringNumber: number,
  pentatonicIndex: number,
): { lower: CAGEDShape; higher: CAGEDShape } {
  let lower: CAGEDShape | undefined;
  let higher: CAGEDShape | undefined;

  for (const shape of CAGED_SHAPES) {
    const [first, second] = getNotesForStringInShape(stringNumber, shape);
    if (second === pentatonicIndex) lower = shape;
    if (first === pentatonicIndex) higher = shape;
  }

  if (lower === undefined || higher === undefined) {
    throw new Error(
      `No CAGED shapes found for pentatonic index ${pentatonicIndex} on string ${stringNumber}`,
    );
  }

  return { lower, higher };
}
