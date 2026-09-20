import {
  chroma,
  getChord,
  getScale,
  identifyChord,
  pitchClass,
  requireInScale,
} from './theory';

test('validates note names, preserves pitch-class spelling and matches enharmonics', () => {
  expect(pitchClass('Db4')).toBe('Db');
  expect(chroma('C#')).toBe(chroma('Db'));
  expect(() => pitchClass('H')).toThrow('Unknown note');
  expect(() => getChord('nonsense')).toThrow('Unknown chord');
  expect(() => getScale('unknown')).toThrow('Unknown scale');
});
test('first supplied note remains the bass, including inverted and ambiguous chords', () => {
  expect(
    identifyChord(['E3', 'G3', 'C4']).candidates.map(c => c.symbol),
  ).toContain('CM/E');
  expect(
    identifyChord(['C', 'E', 'G', 'A']).candidates.map(c => c.symbol),
  ).toEqual(expect.arrayContaining(['C6', 'Am7/C']));
  expect(
    identifyChord(['Db', 'F', 'Ab']).candidates[0].notes.map(chroma),
  ).toEqual([1, 5, 8]);
});
test('scale validation uses pitch classes and returns scale spellings', () => {
  expect(requireInScale(['C#', 'F', 'G#'], 'Db major')).toEqual([
    'Db',
    'F',
    'Ab',
  ]);
  expect(() => requireInScale(['F#'], 'C major')).toThrow('outside');
  expect(() => requireInScale(['C'], null)).toThrow('Select a scale');
  expect(getChord('C/D').notes).toEqual(['D', 'C', 'E', 'G']);
  expect(getScale('C major').pentatonicNotes).toEqual([
    'C',
    'D',
    'E',
    'G',
    'A',
  ]);
});
