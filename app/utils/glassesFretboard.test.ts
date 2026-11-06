import {
  GLASSES_KEYS,
  GLASSES_SHAPES,
  MAX_STARTING_FRET,
  clampStartingFret,
  cycle,
  findShapeWindow,
  getMarker,
} from './glassesFretboard';

describe('glassesFretboard', () => {
  it('has 12 keys per mode and cycles both ways', () => {
    expect(GLASSES_KEYS.major).toHaveLength(12);
    expect(GLASSES_KEYS.minor).toHaveLength(12);
    expect(cycle(GLASSES_SHAPES, 'off', -1)).toBe('ALL');
    expect(cycle(GLASSES_SHAPES, 'ALL', 1)).toBe('off');
  });

  it('clamps the starting fret to the neck', () => {
    expect(clampStartingFret(-3)).toBe(0);
    expect(clampStartingFret(99)).toBe(MAX_STARTING_FRET);
  });

  it('marks scale notes and the root, spelled in the key', () => {
    // low E string (index 5), fret 3 = G: root of G major
    expect(getMarker('G', 'major', 'off', 5, 3)).toMatchObject({
      note: 'G',
      isRoot: true,
    });
    // high E string fret 6 = A# / Bb: in F major, spelled Bb
    expect(getMarker('F', 'major', 'off', 0, 6)?.note).toBe('Bb');
    // C# is not in C major
    expect(getMarker('C', 'major', 'off', 1, 2)).toBeNull();
  });

  it('colors CAGED notes and finds a window for a shape', () => {
    const marker = getMarker('C', 'major', 'E', 5, 8);
    expect(marker?.isRoot).toBe(true);
    expect(marker?.colors).toEqual(['yellow']);
    const window = findShapeWindow('C', 'major', 'E');
    expect(window).not.toBeNull();
    expect(window! + 1).toBeLessThanOrEqual(8);
    expect(window! + 5).toBeGreaterThanOrEqual(8);
    expect(findShapeWindow('C', 'major', 'off')).toBeNull();
  });
});
