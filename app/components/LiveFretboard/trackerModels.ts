import type { FretTrackerModelId } from '~/types/fretTracker';

// Fretboard models bundled with the desktop app (desktop/tracker.cjs).
export const TRACKER_MODELS: { id: FretTrackerModelId; label: string }[] = [
  { id: 'v1', label: 'YOLO v1 (AGPL)' },
  { id: 'v3', label: 'FretNet v3 (permissive)' },
  { id: 'v4q832', label: 'v4q-832 (permissive)' },
  { id: 'r832_w8a8', label: 'v4q-832 fast (8-bit)' },
  { id: 'extended_512_w8a8', label: 'ResNet-34 512 fast (8-bit)' },
];

export const DEFAULT_TRACKER_MODEL: FretTrackerModelId = 'extended_512_w8a8';

export const trackerInputSize = (model: FretTrackerModelId): number =>
  ({ v1: 640, v3: 640, v4q832: 832, r832_w8a8: 832, extended_512_w8a8: 512 })[
    model
  ];

export const TRACKER_MODEL_KEY = 'jam-live-fretboard-model';

/** The persisted model id, or the default when unset or no longer bundled. */
export function storedTrackerModel(value: string | null): FretTrackerModelId {
  return (
    TRACKER_MODELS.find(model => model.id === value)?.id ??
    DEFAULT_TRACKER_MODEL
  );
}
