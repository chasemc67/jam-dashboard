import {
  frequencyToNoteName,
  isLikelyGuitarRange,
  getRms,
} from './pitchDetection';

jest.mock('pitchy', () => ({
  PitchDetector: {
    forFloat32Array: (len: number) => ({
      inputLength: len,
      set minVolumeDecibels(_db: number) {},
      findPitch: (input: ArrayLike<number>, _sr: number) => {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        if (rms < 0.01) return [0, 0];
        return [440, 0.98];
      },
    }),
  },
}));

import { detectPitch } from './pitchDetection';

describe('frequencyToNoteName', () => {
  test('returns A for 440Hz', () => {
    expect(frequencyToNoteName(440)).toBe('A');
  });

  test('returns E for low E string (~82.4Hz)', () => {
    expect(frequencyToNoteName(82.41)).toBe('E');
  });

  test('returns B for open B string (~246.9Hz)', () => {
    expect(frequencyToNoteName(246.94)).toBe('B');
  });

  test('returns G for open G string (~196Hz)', () => {
    expect(frequencyToNoteName(196.0)).toBe('G');
  });

  test('returns D for open D string (~146.8Hz)', () => {
    expect(frequencyToNoteName(146.83)).toBe('D');
  });

  test('returns null for 0Hz', () => {
    expect(frequencyToNoteName(0)).toBeNull();
  });

  test('returns null for negative frequency', () => {
    expect(frequencyToNoteName(-100)).toBeNull();
  });
});

describe('isLikelyGuitarRange', () => {
  test('returns true for standard guitar frequencies', () => {
    expect(isLikelyGuitarRange(82.41)).toBe(true);
    expect(isLikelyGuitarRange(440)).toBe(true);
    expect(isLikelyGuitarRange(1318.5)).toBe(true);
  });

  test('returns false below guitar range', () => {
    expect(isLikelyGuitarRange(50)).toBe(false);
    expect(isLikelyGuitarRange(0)).toBe(false);
  });

  test('returns false above guitar range', () => {
    expect(isLikelyGuitarRange(2000)).toBe(false);
  });

  test('returns true at boundaries', () => {
    expect(isLikelyGuitarRange(70)).toBe(true);
    expect(isLikelyGuitarRange(1500)).toBe(true);
  });

  test('returns false just outside boundaries', () => {
    expect(isLikelyGuitarRange(69.9)).toBe(false);
    expect(isLikelyGuitarRange(1500.1)).toBe(false);
  });
});

describe('getRms', () => {
  test('returns 0 for silence', () => {
    const buffer = new Float32Array(1024);
    expect(getRms(buffer)).toBe(0);
  });

  test('returns correct RMS for known signal', () => {
    const buffer = new Float32Array(4);
    buffer[0] = 1;
    buffer[1] = -1;
    buffer[2] = 1;
    buffer[3] = -1;
    expect(getRms(buffer)).toBeCloseTo(1.0, 5);
  });

  test('returns correct RMS for half-amplitude signal', () => {
    const buffer = new Float32Array(4);
    buffer[0] = 0.5;
    buffer[1] = -0.5;
    buffer[2] = 0.5;
    buffer[3] = -0.5;
    expect(getRms(buffer)).toBeCloseTo(0.5, 5);
  });
});

describe('detectPitch', () => {
  test('returns frequency and clarity for a signal with energy', () => {
    const buffer = new Float32Array(2048);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    const result = detectPitch(buffer, 44100);
    expect(result.frequency).toBe(440);
    expect(result.clarity).toBeCloseTo(0.98, 2);
  });

  test('returns null frequency for silence', () => {
    const buffer = new Float32Array(2048);
    const result = detectPitch(buffer, 44100);
    expect(result.frequency).toBeNull();
    expect(result.clarity).toBe(0);
  });
});
