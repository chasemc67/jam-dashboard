import { noteColorClasses } from './noteColors';

export const COLORING_PATTERN_CHOICES = [
  'scale',
  'pentatonic',
  'major/minor chords',
] as const;
export type ColoringPatternType = (typeof COLORING_PATTERN_CHOICES)[number];

export const noteColoringPatterns: Record<
  ColoringPatternType,
  Record<number, keyof typeof noteColorClasses>
> = {
  scale: {
    1: 'blue',
    2: 'red',
    3: 'green',
    4: 'yellow',
    5: 'orange',
    6: 'purple',
    7: 'pink',
  },
  pentatonic: {
    1: 'blue',
    2: 'red',
    3: 'green',
    4: 'grey',
    5: 'orange',
    6: 'grey',
    7: 'pink',
  },
  'major/minor chords': {
    1: 'blue',
    2: 'red',
    3: 'red',
    4: 'blue',
    5: 'blue',
    6: 'red',
    7: 'green',
  },
};

export const getColorForDegree = (
  pattern: ColoringPatternType,
  degree: number,
): keyof typeof noteColorClasses => {
  const colorPattern = noteColoringPatterns[pattern];
  return (
    (colorPattern as Record<number, keyof typeof noteColorClasses>)[degree] ||
    'grey'
  );
};
