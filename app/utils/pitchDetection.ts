import { PitchDetector } from 'pitchy';
import { Note } from 'tonal';

const GUITAR_MIN_HZ = 70;
const GUITAR_MAX_HZ = 1500;

export function isLikelyGuitarRange(hz: number): boolean {
  return hz >= GUITAR_MIN_HZ && hz <= GUITAR_MAX_HZ;
}

export function getRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export function frequencyToNoteName(hz: number): string | null {
  if (hz <= 0) return null;
  const note = Note.fromFreq(hz);
  if (!note) return null;
  return Note.pitchClass(note) || null;
}

export interface PitchResult {
  frequency: number | null;
  clarity: number;
}

let detector: PitchDetector<Float32Array> | null = null;
let detectorSize = 0;

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): PitchResult {
  if (!detector || detectorSize !== buffer.length) {
    detector = PitchDetector.forFloat32Array(buffer.length);
    detector.minVolumeDecibels = -30;
    detectorSize = buffer.length;
  }

  const [frequency, clarity] = detector.findPitch(buffer, sampleRate);

  if (frequency === 0 && clarity === 0) {
    return { frequency: null, clarity: 0 };
  }

  return { frequency, clarity };
}
