import {
  CAGED_COLORS,
  CAGED_NON_SHAPE_COLOR,
  getCagedNoteColors,
  orientCagedColors,
} from './cagedColorUtils';

const C_MAJOR = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const C_MAJOR_PENTATONIC = ['C', 'D', 'E', 'G', 'A'];

const colorsFor = (
  note: string,
  stringNumber: number,
  shape: Parameters<typeof getCagedNoteColors>[2],
) => getCagedNoteColors(note, stringNumber, shape, C_MAJOR, C_MAJOR_PENTATONIC);

describe('cagedColorUtils', () => {
  describe('getCagedNoteColors with a single shape', () => {
    it('returns undefined for notes outside the scale', () => {
      expect(colorsFor('F#', 1, 'C')).toBeUndefined();
    });

    it('colors notes in the shape with the shape color', () => {
      // C shape on high E is E and G
      expect(colorsFor('E', 1, 'C')).toEqual([CAGED_COLORS.C]);
      expect(colorsFor('G', 1, 'C')).toEqual([CAGED_COLORS.C]);
    });

    it('colors pentatonic notes outside the shape grey', () => {
      expect(colorsFor('A', 1, 'C')).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('colors the 4th and 7th grey', () => {
      expect(colorsFor('F', 1, 'C')).toEqual([CAGED_NON_SHAPE_COLOR]);
      expect(colorsFor('B', 1, 'C')).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('treats enharmonic equivalents as the same note', () => {
      const G_MAJOR = ['G', 'A', 'B', 'C', 'D', 'E', 'F#'];
      const G_MAJOR_PENTATONIC = ['G', 'A', 'B', 'D', 'E'];
      // Gb is the 7th (F#) of G major, so grey (not in the pentatonic)
      expect(
        getCagedNoteColors('Gb', 1, 'C', G_MAJOR, G_MAJOR_PENTATONIC),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
      // Fb is the 3rd (E) of C major, which is in the C shape on high E
      expect(colorsFor('Fb', 1, 'C')).toEqual([CAGED_COLORS.C]);
    });
  });

  describe('getCagedNoteColors with ALL shapes', () => {
    it('splits shared notes between the lower and higher shape, nut side first', () => {
      // On high E, G is the top of the C shape and the bottom of the A shape
      expect(colorsFor('G', 1, 'ALL')).toEqual([
        CAGED_COLORS.C,
        CAGED_COLORS.A,
      ]);
      // E is the top of the D shape and the bottom of the C shape
      expect(colorsFor('E', 1, 'ALL')).toEqual([
        CAGED_COLORS.D,
        CAGED_COLORS.C,
      ]);
    });

    it('gives every pentatonic note on every string two distinct shape colors', () => {
      const shapeColors = Object.values(CAGED_COLORS);
      for (let string = 1; string <= 6; string++) {
        C_MAJOR_PENTATONIC.forEach(note => {
          const colors = colorsFor(note, string, 'ALL');
          expect(colors).toHaveLength(2);
          expect(shapeColors).toContain(colors?.[0]);
          expect(shapeColors).toContain(colors?.[1]);
          expect(colors?.[0]).not.toEqual(colors?.[1]);
        });
      }
    });

    it('colors the 4th and 7th grey', () => {
      expect(colorsFor('F', 2, 'ALL')).toEqual([CAGED_NON_SHAPE_COLOR]);
      expect(colorsFor('B', 5, 'ALL')).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('returns undefined for notes outside the scale', () => {
      expect(colorsFor('Bb', 1, 'ALL')).toBeUndefined();
    });
  });

  describe('orientCagedColors', () => {
    it('keeps nut-to-bridge order for right-handed view', () => {
      expect(orientCagedColors(['red', 'blue'], false)).toEqual([
        'red',
        'blue',
      ]);
    });

    it('reverses the order for left-handed view', () => {
      expect(orientCagedColors(['red', 'blue'], true)).toEqual(['blue', 'red']);
    });

    it('leaves single colors untouched', () => {
      expect(orientCagedColors(['red'], true)).toEqual(['red']);
      expect(orientCagedColors(['red'], false)).toEqual(['red']);
    });
  });
});
