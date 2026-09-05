import {
  CAGED_COLORS,
  CAGED_NON_SHAPE_COLOR,
  getCagedNoteColors,
  orientCagedColors,
} from './cagedColorUtils';

const C_MAJOR = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const C_MAJOR_PENTATONIC = ['C', 'D', 'E', 'G', 'A'];

describe('cagedColorUtils', () => {
  describe('getCagedNoteColors with a single shape', () => {
    it('returns undefined for notes outside the scale', () => {
      expect(
        getCagedNoteColors(
          'F#',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toBeUndefined();
    });

    it('colors notes in the shape with the shape color', () => {
      // C shape on high E is E and G
      expect(
        getCagedNoteColors(
          'E',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.C]);
      expect(
        getCagedNoteColors(
          'G',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.C]);
    });

    it('colors pentatonic notes outside the shape grey', () => {
      expect(
        getCagedNoteColors(
          'A',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('colors the 4th and 7th grey by default', () => {
      expect(
        getCagedNoteColors(
          'F',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
      expect(
        getCagedNoteColors(
          'B',
          1,
          { cagedShape: 'C' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('treats enharmonic equivalents as the same note', () => {
      const G_MAJOR = ['G', 'A', 'B', 'C', 'D', 'E', 'F#'];
      const G_MAJOR_PENTATONIC = ['G', 'A', 'B', 'D', 'E'];
      // F# is the 7th of G major, so grey (not in the pentatonic)
      expect(
        getCagedNoteColors(
          'Gb',
          1,
          { cagedShape: 'C' },
          G_MAJOR,
          G_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
    });
  });

  describe('getCagedNoteColors with pentatonicOnly', () => {
    it('hides the 4th and 7th', () => {
      expect(
        getCagedNoteColors(
          'F',
          1,
          { cagedShape: 'C', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toBeUndefined();
      expect(
        getCagedNoteColors(
          'B',
          3,
          { cagedShape: 'A', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toBeUndefined();
    });

    it('still greys out pentatonic notes that are not in the shape', () => {
      expect(
        getCagedNoteColors(
          'A',
          1,
          { cagedShape: 'C', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('still colors notes in the shape', () => {
      expect(
        getCagedNoteColors(
          'E',
          1,
          { cagedShape: 'C', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.C]);
    });
  });

  describe('getCagedNoteColors with ALL shapes', () => {
    it('splits shared notes between the lower and higher shape, nut side first', () => {
      // On high E, G is the top of the C shape and the bottom of the A shape
      expect(
        getCagedNoteColors(
          'G',
          1,
          { cagedShape: 'ALL' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.C, CAGED_COLORS.A]);
      // E is the top of the D shape and the bottom of the C shape
      expect(
        getCagedNoteColors(
          'E',
          1,
          { cagedShape: 'ALL' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.D, CAGED_COLORS.C]);
    });

    it('gives every pentatonic note on every string two distinct shape colors', () => {
      const shapeColors = Object.values(CAGED_COLORS);
      for (let string = 1; string <= 6; string++) {
        C_MAJOR_PENTATONIC.forEach(note => {
          const colors = getCagedNoteColors(
            note,
            string,
            { cagedShape: 'ALL' },
            C_MAJOR,
            C_MAJOR_PENTATONIC,
          );
          expect(colors).toHaveLength(2);
          expect(shapeColors).toContain(colors?.[0]);
          expect(shapeColors).toContain(colors?.[1]);
          expect(colors?.[0]).not.toEqual(colors?.[1]);
        });
      }
    });

    it('colors the 4th and 7th grey', () => {
      expect(
        getCagedNoteColors(
          'F',
          2,
          { cagedShape: 'ALL' },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_NON_SHAPE_COLOR]);
    });

    it('hides the 4th and 7th when combined with pentatonicOnly', () => {
      expect(
        getCagedNoteColors(
          'F',
          2,
          { cagedShape: 'ALL', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toBeUndefined();
      expect(
        getCagedNoteColors(
          'G',
          1,
          { cagedShape: 'ALL', pentatonicOnly: true },
          C_MAJOR,
          C_MAJOR_PENTATONIC,
        ),
      ).toEqual([CAGED_COLORS.C, CAGED_COLORS.A]);
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
