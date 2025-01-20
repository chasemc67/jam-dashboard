import { areNotesEquivalent, addOctavesToChordNotes } from './musicTheoryUtils';

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

describe('addOctavesToChordNotes', () => {
  test('handles empty array', () => {
    expect(addOctavesToChordNotes([])).toEqual([]);
  });

  test('adds default octave 4 to single note', () => {
    expect(addOctavesToChordNotes(['C'])).toEqual(['C4']);
  });

  test('adds specified start octave to single note', () => {
    expect(addOctavesToChordNotes(['C'], 3)).toEqual(['C3']);
  });

  test('handles ascending notes within same octave', () => {
    expect(addOctavesToChordNotes(['C', 'E', 'G'])).toEqual(['C4', 'E4', 'G4']);
  });

  test('handles typical closed position C major 7 chord', () => {
    // B is pitch‐class 11, which is higher than G=7, so it stays in the same octave (4)
    expect(addOctavesToChordNotes(['C', 'E', 'G', 'B'])).toEqual([
      'C4',
      'E4',
      'G4',
      'B4',
    ]);
  });

  test('increments octave when next note has lower pitch-class', () => {
    // D (pitch‐class 2) is lower than G (7), so D gets bumped to the next octave
    expect(addOctavesToChordNotes(['C', 'E', 'G', 'D'])).toEqual([
      'C4',
      'E4',
      'G4',
      'D5',
    ]);
  });

  test('handles complex chord with multiple octave changes', () => {
    expect(addOctavesToChordNotes(['G', 'B', 'D', 'F', 'A', 'C', 'E'])).toEqual(
      ['G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6'],
    );
  });

  test('handles notes with accidentals', () => {
    // last note (C, pitch‐class 0) is lower than G# (8), so we jump octaves
    expect(addOctavesToChordNotes(['C#', 'F', 'G#', 'C'])).toEqual([
      'C#4',
      'F4',
      'G#4',
      'C5',
    ]);
  });
});
