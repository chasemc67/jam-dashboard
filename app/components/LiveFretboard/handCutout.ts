import { letterbox } from '~/utils/fretProjection';
import type { HandCutoutOption } from '~/types/fretTracker';

export const HAND_CUTOUT_KEY = 'jam-live-fretboard-hand-cutout';
export const HAND_OPTION_KEY = 'jam-live-fretboard-hand-option';
export const HAND_OPTIONS: { id: HandCutoutOption; label: string }[] = [
  { id: 'vision-fast', label: 'Vision fast' },
  { id: 'vision-balanced', label: 'Vision balanced' },
  { id: 'skin', label: 'Skin color (baseline)' },
];
export function storedHandSettings(
  enabled: string | null,
  option: string | null,
) {
  return {
    enabled: enabled === 'true',
    option:
      HAND_OPTIONS.find(item => item.id === option)?.id ??
      ('vision-fast' as HandCutoutOption),
  };
}

/** Display UV -> letterboxed mask UV. Model flip and camera mirror are independent. */
export function handMaskTransform(
  width: number,
  height: number,
  inputSize: number,
  modelMirrored: boolean,
  displayMirrored: boolean,
): [number, number, number, number] {
  const box = letterbox(width, height, inputSize);
  const flip = modelMirrored !== displayMirrored;
  return [
    ((flip ? -1 : 1) * box.newWidth) / inputSize,
    box.newHeight / inputSize,
    (box.left + (flip ? box.newWidth : 0)) / inputSize,
    box.top / inputSize,
  ];
}
