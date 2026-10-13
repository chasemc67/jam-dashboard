import {
  DEFAULT_TRACKER_MODEL,
  TRACKER_MODELS,
  storedTrackerModel,
  trackerInputSize,
} from './trackerModels';

describe('storedTrackerModel', () => {
  it('keeps a bundled model', () => {
    for (const { id } of TRACKER_MODELS)
      expect(storedTrackerModel(id)).toBe(id);
  });

  it('falls back to the default for unset or unknown values', () => {
    expect(storedTrackerModel(null)).toBe(DEFAULT_TRACKER_MODEL);
    expect(storedTrackerModel('v2')).toBe(DEFAULT_TRACKER_MODEL);
    expect(storedTrackerModel('')).toBe(DEFAULT_TRACKER_MODEL);
    expect(storedTrackerModel('constructor')).toBe(DEFAULT_TRACKER_MODEL);
  });
});

it('uses each bundled model input size and defaults to extended_512_w8a8', () => {
  expect(trackerInputSize('v1')).toBe(640);
  expect(trackerInputSize('v3')).toBe(640);
  expect(trackerInputSize('v4q832')).toBe(832);
  expect(trackerInputSize('r832_w8a8')).toBe(832);
  expect(trackerInputSize('extended_512_w8a8')).toBe(512);
  expect(DEFAULT_TRACKER_MODEL).toBe('extended_512_w8a8');
});
