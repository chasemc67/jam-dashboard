export const COLORING_PATTERN_CHOICES = [
  'scale',
  'pentatonic',
  'major/minor roots',
] as const;
export type ColoringPatternType = (typeof COLORING_PATTERN_CHOICES)[number];
