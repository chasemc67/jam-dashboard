import { displayMirror, modelFlip } from './orientation';

describe('Live Fretboard orientation', () => {
  it('flips the model input for a left-handed player only', () => {
    expect(modelFlip(true)).toBe(true);
    expect(modelFlip(false)).toBe(false);
  });

  it('shows cameras mirrored unless they face away; files as recorded', () => {
    expect(displayMirror('camera')).toBe(true);
    expect(displayMirror('camera', 'user')).toBe(true);
    expect(displayMirror('camera', 'environment')).toBe(false);
    expect(displayMirror('file')).toBe(false);
    expect(displayMirror('file', 'user')).toBe(false);
  });
});
