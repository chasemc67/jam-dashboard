import { noteColorClasses } from './noteColors';

export const COLORING_PATTERN_CHOICES = [
  'scale',
  'pentatonic',
  'major/minor roots',
] as const;
export type ColoringPatternType = (typeof COLORING_PATTERN_CHOICES)[number];

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
): keyof typeof noteColorClasses => {
  const colorPattern = noteColoringPatterns[pattern];
  return (
    (colorPattern as Record<number, keyof typeof noteColorClasses>)[degree] ||
    'grey'
  );
};
