import type { FretTrackerModelId } from '~/types/fretTracker';

// Fretboard models bundled with the desktop app (desktop/tracker.cjs).
export const TRACKER_MODELS: { id: FretTrackerModelId; label: string }[] = [
  { id: 'v1', label: 'YOLO v1 (AGPL)' },
  { id: 'v3', label: 'FretNet v3 (permissive)' },
  { id: 'v4q832', label: 'v4q-832 (permissive)' },
];

// Keep v1 as the speed-oriented default. v4q832 improves held-out accuracy;
// see guitar-overlay eval/refit_validation.md for the full comparison.
export const DEFAULT_TRACKER_MODEL: FretTrackerModelId = 'v1';

export const trackerInputSize = (model: FretTrackerModelId): number =>
  model === 'v4q832' ? 832 : 640;

export const TRACKER_MODEL_KEY = 'jam-live-fretboard-model';

/** The persisted model id, or the default when unset or no longer bundled. */
export function storedTrackerModel(value: string | null): FretTrackerModelId {
  return (
    TRACKER_MODELS.find(model => model.id === value)?.id ??
    DEFAULT_TRACKER_MODEL
  );
}
