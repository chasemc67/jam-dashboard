import { Chord, Note, Scale } from 'tonal';

export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export function pitchClass(value: string): string {
  const note = Note.get(value.trim());
  if (note.empty || note.chroma === undefined)
    throw new ToolError('INVALID_NOTE', `Unknown note: ${value}`);
  return note.pc;
}

export function chroma(value: string): number {
  return Note.chroma(pitchClass(value)) as number;
}

export function getChord(symbol: string) {
  const chord = Chord.get(symbol.trim());
  if (chord.empty || !chord.tonic || !chord.notes.length)
    throw new ToolError('INVALID_CHORD', `Unknown chord: ${symbol}`);
  return {
    symbol: chord.symbol,
    name: chord.name,
    notes: chord.notes,
    intervals: chord.intervals,
    bass: chord.bass || null,
    quality: chord.quality as string,
  };
}

export function getScale(name: string) {
  const scale = Scale.get(name.trim());
  if (scale.empty || !scale.tonic || !scale.notes.length)
    throw new ToolError(
      'INVALID_SCALE',
      `Unknown scale: ${name}. Use a tonic and scale type, such as C major.`,
    );
  const pentatonic = Scale.get(`${scale.name} pentatonic`);
  return {
    name: scale.name,
    tonic: scale.tonic,
    type: scale.type,
    notes: scale.notes,
    intervals: scale.intervals,
    pentatonicNotes: pentatonic.empty ? [] : pentatonic.notes,
  };
}

export function identifyChord(notes: string[]) {
  const normalized = notes.map(pitchClass);
  // Tonal treats the first supplied pitch class as the bass. Never sort it.
  return {
    notes: normalized,
    bass: normalized[0],
    candidates: Chord.detect(normalized).map(getChord),
    interpretation:
      'The first supplied note is the bass; candidates may be ambiguous.',
  };
}

export function requireInScale(notes: string[], scaleName: string | null) {
  if (!scaleName)
    throw new ToolError(
      'SCALE_REQUIRED',
      'Select a scale with set_view before visualizing notes.',
    );
  const scale = getScale(scaleName);
  const allowed = new Set(scale.notes.map(chroma));
  const outside = notes.filter(note => !allowed.has(chroma(note)));
  if (outside.length)
    throw new ToolError(
      'NOTES_OUTSIDE_SCALE',
      `${outside.join(', ')} are outside ${scale.name}. Select a compatible scale explicitly.`,
    );
  // Use the scale's spelling, including flats and double accidentals.
  return [
    ...new Set(
      notes.map(note => scale.notes.find(n => chroma(n) === chroma(note))!),
    ),
  ];
}
