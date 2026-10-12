import type { FretTrackerModelId } from '~/types/fretTracker';

// Fretboard models bundled with the desktop app (desktop/tracker.cjs).
export const TRACKER_MODELS: { id: FretTrackerModelId; label: string }[] = [
  { id: 'v1', label: 'YOLO v1 (AGPL)' },
  { id: 'v3', label: 'FretNet v3 (permissive)' },
];

// v1 stays the default: v3 tracks the grid as well or better but numbers frets
// worse on the frozen eval set (guitar-overlay eval/model_permissive.md).
export const DEFAULT_TRACKER_MODEL: FretTrackerModelId = 'v1';

export const TRACKER_MODEL_KEY = 'jam-live-fretboard-model';

/** The persisted model id, or the default when unset or no longer bundled. */
export function storedTrackerModel(value: string | null): FretTrackerModelId {
  return (
    TRACKER_MODELS.find(model => model.id === value)?.id ??
    DEFAULT_TRACKER_MODEL
  );
}
