import { getEveryChordInScale } from './scaleChords';

describe('Scale Chord Functions', () => {
  describe('getEveryChordInScale', () => {
    test('returns correct chords for D major scale', () => {
      const result = getEveryChordInScale('d major');
      expect(result).toEqual([
        {
          note: 'D',
          chords: [
            'Dmaj',
            'Dmaj7',
            'D5',
            'Dmaj9',
            'Dsus2',
            'Dsus4',
            'DMadd9',
            'D6',
            'D6add9',
            'DM7sus4',
            'Dsus24',
            'DM9sus4',
            'Dmaj13',
            'DM7add13',
          ],
        },
        {
          note: 'E',
          chords: [
            'Emin',
            'Em7',
            'E5',
            'Em9',
            'Esus2',
            'Esus4',
            'Em6',
            'E11',
            'Em11',
            'E7sus4',
            'E4',
            'Emadd4',
            'Em7add11',
            'Esus24',
            'E9sus4',
            'E13sus4',
            'Emadd9',
            'Em69',
            'Em13',
          ],
        },
        {
          note: 'F#',
          chords: [
            'F#min',
            'F#m7',
            'F#5',
            'F#sus4',
            'F#7sus4',
            'F#7#5sus4',
            'F#m#5',
            'F#m7#5',
            'F#4',
            'F#madd4',
            'F#m7add11',
            'F#b9sus',
            'F#11b9',
            'F#7sus4b9b13',
            'F#mb6b9',
          ],
        },
        {
          note: 'G',
          chords: [
            'Gmaj',
            'Gmaj7',
            'G5',
            'Gmaj9',
            'Gsus2',
            'GMadd9',
            'G6',
            'G6add9',
            'Gmaj#4',
            'GM6#11',
            'Gmaj13',
            'GM7add13',
            'Gmaj9#11',
            'G69#11',
            'GM13#11',
          ],
        },
        {
          note: 'A',
          chords: [
            'Amaj',
            'A7',
            'A5',
            'A9',
            'Asus2',
            'Asus4',
            'AMadd9',
            'A6',
            'A11',
            'A7sus4',
            'A6add9',
            'A7no5',
            'A7add6',
            'Asus24',
            'A9sus4',
            'A13sus4',
            'A9no5',
            'A13no5',
            'A13',
          ],
        },
        {
          note: 'B',
          chords: [
            'Bmin',
            'Bm7',
            'B5',
            'Bm9',
            'Bsus2',
            'Bsus4',
            'B11',
            'Bm11',
            'B7sus4',
            'B7#5sus4',
            'Bm#5',
            'Bm7#5',
            'B4',
            'Bmadd4',
            'Bm7add11',
            'Bsus24',
            'B9sus4',
            'Bm9#5',
            'Bmadd9',
            'Bm11A',
          ],
        },
        {
          note: 'C#',
          chords: [
            'C#dim',
            'C#7#5sus4',
            'C#m#5',
            'C#m7#5',
            'C#m7b5',
            'C#4',
            'C#mb6b9',
          ],
        },
      ]);
    });

    test('returns correct chords for C major scale with custom chord types', () => {
      const result = getEveryChordInScale('C major', [
        'maj',
        'min',
        '7',
        'maj7',
        'min7',
        'dim',
      ]);
      expect(result).toEqual([
        { note: 'C', chords: ['Cmaj', 'Cmaj7'] },
        { note: 'D', chords: ['Dmin', 'Dmin7'] },
        { note: 'E', chords: ['Emin', 'Emin7'] },
        { note: 'F', chords: ['Fmaj', 'Fmaj7'] },
        { note: 'G', chords: ['Gmaj', 'G7'] },
        { note: 'A', chords: ['Amin', 'Amin7'] },
        { note: 'B', chords: ['Bdim'] },
      ]);
    });

    test('returns correct chords for C# major scale', () => {
      const result = getEveryChordInScale('C# major', [
        'maj',
        'min',
        '7',
        'maj7',
        'min7',
        'dim',
      ]);
      expect(result).toEqual([
        { note: 'C#', chords: ['C#maj', 'C#maj7'] },
        { note: 'D#', chords: ['D#min', 'D#min7'] },
        { note: 'E#', chords: ['E#min', 'E#min7'] },
        { note: 'F#', chords: ['F#maj', 'F#maj7'] },
        { note: 'G#', chords: ['G#maj', 'G#7'] },
        { note: 'A#', chords: ['A#min', 'A#min7'] },
        { note: 'B#', chords: ['B#dim'] },
      ]);
    });

    test('returns correct chords for C minor scale', () => {
      const result = getEveryChordInScale('C minor', [
        'maj',
        'min',
        '7',
        'maj7',
        'min7',
        'dim',
      ]);
      expect(result).toEqual([
        { note: 'C', chords: ['Cmin', 'Cmin7'] },
        { note: 'D', chords: ['Ddim'] },
        { note: 'Eb', chords: ['Ebmaj', 'Ebmaj7'] },
        { note: 'F', chords: ['Fmin', 'Fmin7'] },
        { note: 'G', chords: ['Gmin', 'Gmin7'] },
        { note: 'Ab', chords: ['Abmaj', 'Abmaj7'] },
        { note: 'Bb', chords: ['Bbmaj', 'Bb7'] },
      ]);
    });
  });
});
