import { letterbox } from '~/utils/fretProjection';
import type { HandCutoutOption } from '~/types/fretTracker';

export const HAND_CUTOUT_KEY = 'jam-live-fretboard-hand-cutout';
export const HAND_OPACITY_KEY = 'jam-live-fretboard-hand-opacity';
export function handOpacity(value: string | null): number {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
}

// Shared shader expression, exercised by the compositing math tests.
export const HAND_ALPHA_GLSL = '1.0 - u_handOpacity * handAlpha';

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
      ('skin' as HandCutoutOption),
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
