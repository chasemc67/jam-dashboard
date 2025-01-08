import { areNotesEquivalent } from './musicTheoryUtils';

describe('areNotesEquivalent', () => {
  test('identifies equivalent natural notes', () => {
    expect(areNotesEquivalent('C', 'C')).toBe(true);
    expect(areNotesEquivalent('D', 'D')).toBe(true);
    expect(areNotesEquivalent('C', 'D')).toBe(false);
  });

  test('identifies equivalent sharp and flat notes', () => {
    expect(areNotesEquivalent('C#', 'Db')).toBe(true);
    expect(areNotesEquivalent('D#', 'Eb')).toBe(true);
    expect(areNotesEquivalent('F#', 'Gb')).toBe(true);
    expect(areNotesEquivalent('G#', 'Ab')).toBe(true);
    expect(areNotesEquivalent('A#', 'Bb')).toBe(true);
  });

  test('identifies equivalent double sharp and double flat notes', () => {
    expect(areNotesEquivalent('C##', 'D')).toBe(true);
    expect(areNotesEquivalent('Dbb', 'C')).toBe(true);
    expect(areNotesEquivalent('F##', 'G')).toBe(true);
    expect(areNotesEquivalent('Gbb', 'F')).toBe(true);
  });

  test('handles case insensitivity', () => {
    expect(areNotesEquivalent('c#', 'C#')).toBe(true);
    expect(areNotesEquivalent('Db', 'db')).toBe(true);
  });

  test('identifies non-equivalent notes', () => {
    expect(areNotesEquivalent('C#', 'D#')).toBe(false);
    expect(areNotesEquivalent('F', 'Gb')).toBe(false);
    expect(areNotesEquivalent('B', 'C')).toBe(false);
  });

  test('handles complex enharmonic equivalents', () => {
    expect(areNotesEquivalent('B#', 'C')).toBe(true);
    expect(areNotesEquivalent('E#', 'F')).toBe(true);
    expect(areNotesEquivalent('Cb', 'B')).toBe(true);
    expect(areNotesEquivalent('B##', 'C#')).toBe(true);
  });
});
