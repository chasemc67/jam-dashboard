import type { FretTrackerModelId } from '~/types/fretTracker';

// Fretboard models bundled with the desktop app (desktop/tracker.cjs).
export const TRACKER_MODELS: { id: FretTrackerModelId; label: string }[] = [
  { id: 'v3', label: 'FretNet v3 (permissive)' },
  { id: 'v1', label: 'YOLO v1 (AGPL)' },
];

export const DEFAULT_TRACKER_MODEL: FretTrackerModelId = 'v3';

export const TRACKER_MODEL_KEY = 'jam-live-fretboard-model';

/** The persisted model id, or the default when unset or no longer bundled. */
export function storedTrackerModel(value: string | null): FretTrackerModelId {
  return (
    TRACKER_MODELS.find(model => model.id === value)?.id ??
    DEFAULT_TRACKER_MODEL
  );
}
