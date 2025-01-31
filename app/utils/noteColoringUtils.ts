import { noteColorClasses } from './noteColors';

export const COLORING_PATTERN_CHOICES = [
  'scale',
  'pentatonic',
  'roots',
  'major/minor roots',
  'root-third',
  'root-fifth',
] as const;
export type ColoringPatternType = (typeof COLORING_PATTERN_CHOICES)[number];

// Pentatonic has a diff pattern for minor keys, and so we're just
// using this as a quick hack to fix the bug if pentatonic highlighting
// not working right now
const pentatonicMinorPattern = {
  1: 'red',
  2: 'grey',
  3: 'green',
  4: 'yellow',
  5: 'orange',
  6: 'grey',
  7: 'pink',
};

export const noteColoringPatterns: Record<
  ColoringPatternType,
  Record<number, keyof typeof noteColorClasses>
> = {
  scale: {
    1: 'red',
    2: 'blue',
    3: 'green',
    4: 'yellow',
    5: 'orange',
    6: 'purple',
    7: 'pink',
  },
  pentatonic: {
    1: 'red',
    2: 'blue',
    3: 'green',
    4: 'grey',
    5: 'orange',
    6: 'purple',
    7: 'grey',
  },
  roots: {
    1: 'red',
    2: 'grey',
    3: 'grey',
    4: 'grey',
    5: 'grey',
    6: 'grey',
    7: 'grey',
  },
  'root-third': {
    1: 'red',
    2: 'grey',
    3: 'green',
    4: 'grey',
    5: 'grey',
    6: 'grey',
    7: 'grey',
  },
  'root-fifth': {
    1: 'red',
    2: 'grey',
    3: 'grey',
    4: 'grey',
    5: 'orange',
    6: 'grey',
    7: 'grey',
  },
  'major/minor roots': {
    1: 'red',
    2: 'blue',
    3: 'blue',
    4: 'red',
    5: 'red',
    6: 'blue',
    7: 'green',
  },
};

export const getColorForDegree = (
  pattern: ColoringPatternType,
  degree: number,
  selectedKey?: string,
): keyof typeof noteColorClasses => {
  const colorPattern = noteColoringPatterns[pattern];
  const isMinorKey = selectedKey?.toLowerCase().includes('minor');
  if (isMinorKey && pattern == 'pentatonic') {
    return (
      pentatonicMinorPattern[degree as keyof typeof pentatonicMinorPattern] ||
      'grey'
    );
  }
  return (
    (colorPattern as Record<number, keyof typeof noteColorClasses>)[degree] ||
    'grey'
  );
};
