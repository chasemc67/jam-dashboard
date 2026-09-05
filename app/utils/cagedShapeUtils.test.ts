import {
  getNotesForStringInShape,
  getShapesForNoteOnString,
  CAGED_SHAPES,
  CAGED_SHAPE_CHOICES,
  type CAGEDShape,
} from './cagedShapeUtils';

describe('cagedShapeUtils', () => {
  describe('getNotesForStringInShape', () => {
    it('returns correct notes for high E string (string 1) in each shape', () => {
      expect(getNotesForStringInShape(1, 'C')).toEqual([2, 3]); // 3rd and 5th
      expect(getNotesForStringInShape(1, 'A')).toEqual([3, 4]); // Root and 2nd
      expect(getNotesForStringInShape(1, 'G')).toEqual([4, 0]); // 5th and 6th
      expect(getNotesForStringInShape(1, 'E')).toEqual([0, 1]); // 2nd and 3rd
      expect(getNotesForStringInShape(1, 'D')).toEqual([1, 2]); // 6th and root
    });

    it('correctly walks back notes for lower strings in C shape', () => {
      // C shape pattern walking down the strings
      expect(getNotesForStringInShape(1, 'C')).toEqual([2, 3]); // High E: 3rd and 5th
      expect(getNotesForStringInShape(2, 'C')).toEqual([0, 1]); // B: 2nd and 3rd
      expect(getNotesForStringInShape(3, 'C')).toEqual([3, 4]); // G: root and 2nd
      expect(getNotesForStringInShape(4, 'C')).toEqual([1, 2]); // D: 6th and root
      expect(getNotesForStringInShape(5, 'C')).toEqual([4, 0]); // A: 5th and 6th
      expect(getNotesForStringInShape(6, 'C')).toEqual([2, 3]); // Low E: 3rd and 5th
    });

    it('handles string numbers greater than 6 by wrapping around', () => {
      // String 6 should be equivalent to string 1
      expect(getNotesForStringInShape(6, 'C')).toEqual(
        getNotesForStringInShape(1, 'C'),
      );
      // String 7 should be equivalent to string 2
      expect(getNotesForStringInShape(7, 'C')).toEqual(
        getNotesForStringInShape(2, 'C'),
      );
      // String 8 should be equivalent to string 3
      expect(getNotesForStringInShape(8, 'C')).toEqual(
        getNotesForStringInShape(3, 'C'),
      );
    });

    it('maintains consistent intervals between adjacent strings', () => {
      const shapes: CAGEDShape[] = ['C', 'A', 'G', 'E', 'D'];

      shapes.forEach(shape => {
        // Test each adjacent string pair
        for (let string = 1; string < 6; string++) {
          const currentString = getNotesForStringInShape(string, shape);
          const nextString = getNotesForStringInShape(string + 1, shape);

          // Verify that the next string's notes are three positions back in the scale
          // accounting for wraparound
          expect(nextString[0]).toEqual((currentString[0] + 3) % 5);
          expect(nextString[1]).toEqual((currentString[1] + 3) % 5);
        }
      });
    });
  });

  describe('getShapesForNoteOnString', () => {
    it('returns the two shapes sharing each note on the high E string', () => {
      // High E: C=[2,3], A=[3,4], G=[4,0], E=[0,1], D=[1,2]
      expect(getShapesForNoteOnString(1, 3)).toEqual({
        lower: 'C',
        higher: 'A',
      });
      expect(getShapesForNoteOnString(1, 4)).toEqual({
        lower: 'A',
        higher: 'G',
      });
      expect(getShapesForNoteOnString(1, 0)).toEqual({
        lower: 'G',
        higher: 'E',
      });
      expect(getShapesForNoteOnString(1, 1)).toEqual({
        lower: 'E',
        higher: 'D',
      });
      expect(getShapesForNoteOnString(1, 2)).toEqual({
        lower: 'D',
        higher: 'C',
      });
    });

    it('is consistent with getNotesForStringInShape on every string', () => {
      for (let string = 1; string <= 8; string++) {
        for (let index = 0; index < 5; index++) {
          const { lower, higher } = getShapesForNoteOnString(string, index);
          expect(getNotesForStringInShape(string, lower)[1]).toEqual(index);
          expect(getNotesForStringInShape(string, higher)[0]).toEqual(index);
          expect(lower).not.toEqual(higher);
        }
      }
    });

    it('always follows the C-A-G-E-D order up the neck', () => {
      for (let string = 1; string <= 6; string++) {
        for (let index = 0; index < 5; index++) {
          const { lower, higher } = getShapesForNoteOnString(string, index);
          const lowerPosition = CAGED_SHAPES.indexOf(lower);
          expect(CAGED_SHAPES[(lowerPosition + 1) % 5]).toEqual(higher);
        }
      }
    });
  });

  describe('shape choices', () => {
    it('includes every single shape plus ALL', () => {
      expect(CAGED_SHAPE_CHOICES).toEqual(['C', 'A', 'G', 'E', 'D', 'ALL']);
    });
  });
});
