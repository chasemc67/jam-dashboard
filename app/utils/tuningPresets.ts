import { areNotesEquivalent, getNoteAtFret } from './musicTheoryUtils';

export interface TuningPreset {
  name: string;
  // Notes from the highest-pitched string to the lowest, for a 6-string guitar
  notes: string[];
}

export const CUSTOM_TUNING_NAME = 'Custom';

export const TUNING_PRESETS: TuningPreset[] = [
  { name: 'E Standard', notes: ['E', 'B', 'G', 'D', 'A', 'E'] },
  { name: 'Eb Standard', notes: ['Eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb'] },
  { name: 'D Standard', notes: ['D', 'A', 'F', 'C', 'G', 'D'] },
  { name: 'Drop D', notes: ['E', 'B', 'G', 'D', 'A', 'D'] },
  { name: 'Drop C#', notes: ['Eb', 'Bb', 'Gb', 'Db', 'Ab', 'Db'] },
  { name: 'Drop C', notes: ['D', 'A', 'F', 'C', 'G', 'C'] },
  { name: 'Drop B', notes: ['C#', 'G#', 'E', 'B', 'F#', 'B'] },
  { name: 'DADGAD', notes: ['D', 'A', 'G', 'D', 'A', 'D'] },
  { name: 'Open D', notes: ['D', 'A', 'F#', 'D', 'A', 'D'] },
  { name: 'Open E', notes: ['E', 'B', 'G#', 'E', 'B', 'E'] },
  { name: 'Open G', notes: ['D', 'B', 'G', 'D', 'G', 'D'] },
  { name: 'Open A', notes: ['E', 'C#', 'A', 'E', 'A', 'E'] },
];

// 7 semitones up is enharmonically a perfect fourth down, which is how
// extended-range guitars usually add their extra low strings (B, F#, ...)
const PERFECT_FOURTH_DOWN_IN_SEMITONES = 7;

/**
 * Expands a 6-string preset to the given number of strings.
 * Fewer strings drop the lowest ones; extra strings continue a fourth below the lowest.
 */
export function getTuningForStrings(
  preset: TuningPreset,
  numberOfStrings: number,
): string[] {
  const tuning = preset.notes.slice(0, numberOfStrings);
  while (tuning.length < numberOfStrings) {
    tuning.push(
      getNoteAtFret(
        tuning[tuning.length - 1],
        PERFECT_FOURTH_DOWN_IN_SEMITONES,
      ),
    );
  }
  return tuning;
}

/**
 * Finds the preset whose notes match the given tuning (ignoring enharmonic spelling).
 */
export function findMatchingPreset(
  rootNotes: string[],
): TuningPreset | undefined {
  return TUNING_PRESETS.find(preset => {
    const presetNotes = getTuningForStrings(preset, rootNotes.length);
    return presetNotes.every(
      (note, index) =>
        rootNotes[index] !== '' && areNotesEquivalent(note, rootNotes[index]),
    );
  });
}
