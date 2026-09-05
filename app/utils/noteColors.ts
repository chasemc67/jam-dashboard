type NoteColorClasses = {
  background: string;
  border: string;
  // Left + top borders, used for the first color of a two-color (split) outline
  borderStart: string;
  // Right + bottom borders, used for the second color of a two-color (split) outline
  borderEnd: string;
};

// Explicitly define the note colors and their corresponding classes
// so that tailwind will generate the classes for the colors
export const noteColorClasses: Record<string, NoteColorClasses> = {
  grey: {
    background: 'bg-note-grey',
    border: 'border-note-grey',
    borderStart: 'border-l-note-grey border-t-note-grey',
    borderEnd: 'border-r-note-grey border-b-note-grey',
  },
  red: {
    background: 'bg-note-red',
    border: 'border-note-red',
    borderStart: 'border-l-note-red border-t-note-red',
    borderEnd: 'border-r-note-red border-b-note-red',
  },
  blue: {
    background: 'bg-note-blue',
    border: 'border-note-blue',
    borderStart: 'border-l-note-blue border-t-note-blue',
    borderEnd: 'border-r-note-blue border-b-note-blue',
  },
  green: {
    background: 'bg-note-green',
    border: 'border-note-green',
    borderStart: 'border-l-note-green border-t-note-green',
    borderEnd: 'border-r-note-green border-b-note-green',
  },
  yellow: {
    background: 'bg-note-yellow',
    border: 'border-note-yellow',
    borderStart: 'border-l-note-yellow border-t-note-yellow',
    borderEnd: 'border-r-note-yellow border-b-note-yellow',
  },
  orange: {
    background: 'bg-note-orange',
    border: 'border-note-orange',
    borderStart: 'border-l-note-orange border-t-note-orange',
    borderEnd: 'border-r-note-orange border-b-note-orange',
  },
  purple: {
    background: 'bg-note-purple',
    border: 'border-note-purple',
    borderStart: 'border-l-note-purple border-t-note-purple',
    borderEnd: 'border-r-note-purple border-b-note-purple',
  },
  pink: {
    background: 'bg-note-pink',
    border: 'border-note-pink',
    borderStart: 'border-l-note-pink border-t-note-pink',
    borderEnd: 'border-r-note-pink border-b-note-pink',
  },
} as const;

export const getNoteColorClass = (
  color: string,
  type: keyof NoteColorClasses = 'background',
): string => {
  return noteColorClasses[color]?.[type] || '';
};

/**
 * Border classes for an outline that is either a single color, or split
 * diagonally between two colors (first color on the left/top, second on the right/bottom)
 */
export const getSplitBorderClasses = (colors: readonly string[]): string => {
  if (colors.length === 1) {
    return getNoteColorClass(colors[0], 'border');
  }
  return `${getNoteColorClass(colors[0], 'borderStart')} ${getNoteColorClass(colors[1], 'borderEnd')}`;
};
