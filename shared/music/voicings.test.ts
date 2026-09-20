import { Note } from 'tonal';
import { findVoicings, STANDARD_TUNING } from './voicings';
import { chroma, getChord } from './theory';

// An independent exhaustive oracle over every string choice on a tiny neck.
function exhaustive(chord: string, maxFret: number) {
  const wanted = [...new Set(getChord(chord).notes.map(chroma))]
    .sort()
    .join(',');
  const choices: (number | null)[] = [
    null,
    ...Array.from({ length: maxFret + 1 }, (_, i) => i),
  ];
  let all: (number | null)[][] = [[]];
  for (let i = 0; i < 6; i++)
    all = all.flatMap(row => choices.map(f => [...row, f]));
  return all
    .filter(row => {
      const pitches = row.flatMap((f, i) =>
        f === null ? [] : [Note.midi(STANDARD_TUNING[i])! + f],
      );
      const tones = [...new Set(pitches.map(p => p % 12))].sort().join(',');
      const bass = getChord(chord).bass;
      return (
        tones === wanted &&
        (!bass || Math.min(...pitches) % 12 === chroma(bass))
      );
    })
    .map(row => row.map(f => (f === null ? 'x' : f)).join('-'))
    .sort();
}
test.each(['C', 'C/E', 'Dm', 'Am7'])(
  'enumerates %s exactly on a tiny fretboard',
  chord => {
    const expected = exhaustive(chord, 1);
    const actual = findVoicings(chord, { maxFret: 1 });
    expect(actual.complete).toBe(true);
    expect(actual.voicings.map(v => v.id).sort()).toEqual(expected);
  },
);
test('all returned notes, spans, duplicates, string positions and slash bass obey constraints', () => {
  const result = findVoicings('C/E', { maxFret: 24, maxSpan: 3 });
  for (const v of result.voicings) {
    expect([...new Set(v.notes.map(chroma))].sort()).toEqual([0, 4, 7]);
    expect(v.span).toBeLessThanOrEqual(3);
    expect(chroma(v.bass)).toBe(4);
    expect(new Set(v.positions.map(p => p.string)).size).toBe(
      v.positions.length,
    );
    expect(v.positions.every(p => p.fret >= 0 && p.fret <= 24)).toBe(true);
  }
  expect(new Set(result.voicings.map(v => v.id)).size).toBe(
    result.voicings.length,
  );
});
test('reports result limits honestly and validates bounds', () => {
  const limited = findVoicings('C', { limit: 1 });
  expect(limited.voicings).toHaveLength(1);
  expect(limited).toMatchObject({
    complete: false,
    truncated: true,
    stopReason: 'result_limit',
  });
  expect(limited.visited).toBeLessThanOrEqual(limited.nodeBudget + 1);
  expect(findVoicings('C', { maxFret: 0 })).toMatchObject({
    complete: true,
    voicings: [],
  });
  expect(() => findVoicings('C', { maxFret: 30 })).toThrow();
  expect(() => findVoicings('C', { minFret: 10, maxFret: 1 })).toThrow();
  expect(() => findVoicings('C', { limit: 100 })).toThrow();
});
test('bounded work reports incomplete searches even when no result was found', () => {
  const result = findVoicings('C13b9#11', { maxFret: 24, maxSpan: 5 });
  expect(result).toMatchObject({
    complete: false,
    stopReason: 'work_limit',
    voicings: [],
  });
  expect(result.visited).toBe(result.nodeBudget + 1);
});
test('open strings do not increase the fretting span and muted strings are supported', () => {
  const result = findVoicings('C', { maxFret: 3 });
  expect(result.voicings.some(v => v.frets.includes(0))).toBe(true);
  expect(result.voicings.some(v => v.frets.includes(null))).toBe(true);
  expect(
    findVoicings('C', { minFret: 1, maxFret: 3 }).voicings.every(
      v => !v.frets.includes(0),
    ),
  ).toBe(true);
});
