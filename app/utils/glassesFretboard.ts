// Pure helpers for the glasses (/glasses) fretboard: which key, which window of
// frets, and which note to draw on each string. Reuses the site's scale and
// CAGED coloring so the glasses view matches the main fretboard.
import { Scale } from 'tonal';
import { getNoteAtFret, areNotesEquivalent } from '~/utils/musicTheoryUtils';
import { getCagedNoteColors } from '~/utils/cagedColorUtils';
import type { CAGEDShapeSelection } from '~/utils/cagedShapeUtils';
import { TUNING_PRESETS } from '~/utils/tuningPresets';

export type GlassesMode = 'major' | 'minor';
export type GlassesShape = 'off' | CAGEDShapeSelection;

// One spelling per pitch class, picked so each key reads cleanly.
export const GLASSES_KEYS: Record<GlassesMode, string[]> = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
};

export const GLASSES_SHAPES: GlassesShape[] = [
  'off',
  'C',
  'A',
  'G',
  'E',
  'D',
  'ALL',
];

export const WINDOW_FRETS = 5;
export const MAX_FRET = 24;
export const MAX_STARTING_FRET = MAX_FRET - WINDOW_FRETS;

/** Highest-pitched string first, like the main fretboard. */
export const GLASSES_TUNING = TUNING_PRESETS[0].notes;

const SCALE_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
];

export const cycle = <T>(items: readonly T[], current: T, step: number): T => {
  const index = items.indexOf(current);
  const length = items.length;
  return items[(((index + step) % length) + length) % length];
};

export const clampStartingFret = (fret: number) =>
  Math.max(0, Math.min(MAX_STARTING_FRET, Math.round(fret)));

export function getKeyNotes(key: string, mode: GlassesMode) {
  const scale = Scale.get(`${key} ${mode}`);
  const pentatonic = Scale.get(`${key} ${mode} pentatonic`);
  return {
    notes: scale.notes,
    pentatonicNotes: pentatonic.empty ? [] : pentatonic.notes,
  };
}

export type GlassesMarker = {
  /** 1-based, 1 = high E. */
  string: number;
  fret: number;
  /** Spelled as in the key, e.g. Bb in F major. */
  note: string;
  isRoot: boolean;
  /** One color, or two (nut side first) for a note shared by two CAGED shapes. */
  colors: [string] | [string, string];
};

export function getMarker(
  key: string,
  mode: GlassesMode,
  shape: GlassesShape,
  stringIndex: number,
  fret: number,
  tuning: string[] = GLASSES_TUNING,
): GlassesMarker | null {
  const { notes, pentatonicNotes } = getKeyNotes(key, mode);
  const raw = getNoteAtFret(tuning[stringIndex], fret);
  const degree = notes.findIndex(n => areNotesEquivalent(n, raw));
  if (degree === -1) return null;
  let colors: GlassesMarker['colors'];
  if (shape === 'off') {
    colors = [SCALE_COLORS[degree % SCALE_COLORS.length]];
  } else {
    const caged = getCagedNoteColors(
      raw,
      stringIndex + 1,
      shape,
      notes,
      pentatonicNotes,
    );
    if (!caged) return null;
    colors = caged;
  }
  return {
    string: stringIndex + 1,
    fret,
    note: notes[degree],
    isRoot: degree === 0,
    colors,
  };
}

/**
 * The starting fret whose window shows the most notes of a single CAGED shape,
 * preferring the lowest such window, so picking a shape slides to it.
 */
export function findShapeWindow(
  key: string,
  mode: GlassesMode,
  shape: GlassesShape,
  tuning: string[] = GLASSES_TUNING,
): number | null {
  if (shape === 'off' || shape === 'ALL') return null;
  let best: number | null = null;
  let bestCount = 0;
  for (let start = 0; start <= MAX_STARTING_FRET; start++) {
    let count = 0;
    for (let fret = start + 1; fret <= start + WINDOW_FRETS; fret++)
      tuning.forEach((_, stringIndex) => {
        const marker = getMarker(key, mode, shape, stringIndex, fret, tuning);
        if (marker && marker.colors[0] !== 'grey') count++;
      });
    if (count > bestCount) {
      best = start;
      bestCount = count;
    }
  }
  return best;
}
