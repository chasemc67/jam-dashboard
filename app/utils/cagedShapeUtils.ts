// Types for CAGED shapes and string positions
export type CAGEDShape = 'C' | 'A' | 'G' | 'E' | 'D';

// Interface defining which pentatonic scale indices appear on the high E string for each shape
interface ShapeHighEConfig {
  noteIndices: [number, number]; // The indices in the pentatonic scale array that appear on high E
}

// Assuming we have an array of the notes in the pentatonic scale intervals
// like [1, 2, 3, 5, 6]
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
  const offset = normalizedString - 1;
  const [firstNote, secondNote] = baseConfig.noteIndices;

  // Calculate new indices with wraparound (modulo 5 since pentatonic has 5 notes)
  const newFirstNote = (firstNote - offset + 5) % 5;
  const newSecondNote = (secondNote - offset + 5) % 5;

  return [newFirstNote, newSecondNote];
}
