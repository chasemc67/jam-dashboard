import {
  DEFAULT_TRACKER_MODEL,
  TRACKER_MODELS,
  storedTrackerModel,
} from './trackerModels';

describe('storedTrackerModel', () => {
  it('keeps a bundled model', () => {
    for (const { id } of TRACKER_MODELS)
      expect(storedTrackerModel(id)).toBe(id);
  });

  it('falls back to the default for unset or unknown values', () => {
    expect(storedTrackerModel(null)).toBe(DEFAULT_TRACKER_MODEL);
    expect(storedTrackerModel('v2')).toBe(DEFAULT_TRACKER_MODEL);
  });
});
