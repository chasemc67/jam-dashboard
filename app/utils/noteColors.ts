type NoteColorClasses = {
  background: string;
  border: string;
};

// Explicitly define the note colors and their corresponding classes
// so that tailwind will generate the classes for the colors
export const noteColorClasses: Record<string, NoteColorClasses> = {
  grey: {
    background: 'bg-note-grey',
    border: 'border-note-grey',
  },
  red: {
    background: 'bg-note-red',
    border: 'border-note-red',
  },
  blue: {
    background: 'bg-note-blue',
    border: 'border-note-blue',
  },
  green: {
    background: 'bg-note-green',
    border: 'border-note-green',
  },
  yellow: {
    background: 'bg-note-yellow',
    border: 'border-note-yellow',
  },
  orange: {
    background: 'bg-note-orange',
    border: 'border-note-orange',
  },
  purple: {
    background: 'bg-note-purple',
    border: 'border-note-purple',
  },
  pink: {
    background: 'bg-note-pink',
    border: 'border-note-pink',
  },
} as const;

export const getNoteColorClass = (
  color: string,
  type: 'background' | 'border' = 'background',
): string => {
  return noteColorClasses[color]?.[type] || '';
};
