import { Note } from 'tonal';
import { z } from 'zod/v4';
import { chroma, getChord } from './theory';

// String 1 is the highest-pitched string, matching the existing renderer.
export const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'] as const;
export const STANDARD_PITCH_CLASSES = ['E', 'B', 'G', 'D', 'A', 'E'];
export const VoicingOptionsSchema = z
  .strictObject({
    minFret: z.number().int().min(0).max(24).default(0),
    maxFret: z.number().int().min(0).max(24).default(12),
    maxSpan: z.number().int().min(0).max(5).default(4),
    limit: z.number().int().min(1).max(20).default(20),
  })
  .refine(o => o.minFret <= o.maxFret, 'minFret must not exceed maxFret');

export const PositionSchema = z.strictObject({
  string: z
    .number()
    .int()
    .min(1)
    .max(8)
    .describe('1 is the top/high string in the fretboard.'),
  fret: z.number().int().min(0).max(24),
});
export type Position = z.infer<typeof PositionSchema>;
export type Voicing = {
  id: string;
  frets: (number | null)[];
  positions: Position[];
  notes: string[];
  bass: string;
  span: number;
};
export type VoicingResult = ReturnType<typeof findVoicings>;

const NODE_BUDGET = 100_000;

/** Bounded enumeration, not a fingering or ergonomic solver. */
export function findVoicings(
  chordName: string,
  input: z.input<typeof VoicingOptionsSchema> = {},
) {
  const options = VoicingOptionsSchema.parse(input);
  const chord = getChord(chordName);
  const required = new Set(chord.notes.map(chroma));
  const bass = chord.bass ? chroma(chord.bass) : null;
  const openMidi = STANDARD_TUNING.map(note => Note.midi(note)!);
  const candidates = openMidi.map(midi => {
    const frets: (number | null)[] = [];
    for (let fret = options.minFret; fret <= options.maxFret; fret++) {
      if (required.has((midi + fret) % 12)) frets.push(fret);
    }
    return [...frets, null];
  });
  const results: Voicing[] = [];
  let visited = 0;
  let reason: 'result_limit' | 'work_limit' | null = null;
  const frets: (number | null)[] = Array(6).fill(null);

  function search(string: number, low: number, high: number) {
    if (reason) return;
    if (++visited > NODE_BUDGET) {
      reason = 'work_limit';
      return;
    }
    if (string === 6) {
      const pitches = frets.flatMap((fret, i) =>
        fret === null ? [] : [openMidi[i] + fret],
      );
      const present = new Set(pitches.map(midi => midi % 12));
      if (present.size !== required.size || !pitches.length) return;
      const lowest = Math.min(...pitches);
      if (bass !== null && lowest % 12 !== bass) return;
      // Search one beyond the requested count so 'complete' is truthful.
      if (results.length === options.limit) {
        reason = 'result_limit';
        return;
      }
      results.push({
        id: frets.map(fret => (fret === null ? 'x' : fret)).join('-'),
        frets: [...frets],
        positions: frets.flatMap((fret, i) =>
          fret === null ? [] : [{ string: i + 1, fret }],
        ),
        notes: pitches.map(midi => Note.fromMidi(midi)),
        bass: Note.fromMidi(lowest),
        span: Number.isFinite(low) ? high - low : 0,
      });
      return;
    }
    for (const fret of candidates[string]) {
      // Open strings do not contribute to the fretting-hand span.
      const nextLow = fret !== null && fret > 0 ? Math.min(low, fret) : low;
      const nextHigh = fret !== null && fret > 0 ? Math.max(high, fret) : high;
      if (Number.isFinite(nextLow) && nextHigh - nextLow > options.maxSpan)
        continue;
      frets[string] = fret;
      search(string + 1, nextLow, nextHigh);
      if (reason) break;
    }
  }
  search(0, Infinity, -Infinity);
  return {
    algorithmVersion: 1 as const,
    chord,
    tuning: [...STANDARD_TUNING] as string[],
    stringOrder: 'high-to-low' as const,
    options,
    voicings: results,
    complete: reason === null,
    truncated: reason !== null,
    stopReason: reason as 'result_limit' | 'work_limit' | null,
    visited,
    nodeBudget: NODE_BUDGET,
    rules:
      'All chord tones required; duplicates, open and muted strings allowed. Open strings excluded from span. Slash bass enforced by sounding pitch. Deterministic order, no ergonomic ranking.',
  };
}
