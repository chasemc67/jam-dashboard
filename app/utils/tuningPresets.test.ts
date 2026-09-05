import {
  TUNING_PRESETS,
  findMatchingPreset,
  getTuningForStrings,
} from './tuningPresets';

const presetByName = (name: string) => {
  const preset = TUNING_PRESETS.find(p => p.name === name);
  if (!preset) throw new Error(`Missing preset ${name}`);
  return preset;
};

describe('tuningPresets', () => {
  describe('TUNING_PRESETS', () => {
    it('includes the common tunings', () => {
      const names = TUNING_PRESETS.map(p => p.name);
      expect(names).toEqual(
        expect.arrayContaining(['E Standard', 'Drop D', 'Drop C']),
      );
    });

    it('defines every preset for six strings with unique names', () => {
      TUNING_PRESETS.forEach(preset => {
        expect(preset.notes).toHaveLength(6);
      });
      const names = TUNING_PRESETS.map(p => p.name);
      expect(new Set(names).size).toEqual(names.length);
    });
  });

  describe('getTuningForStrings', () => {
    it('returns the preset unchanged for six strings', () => {
      expect(getTuningForStrings(presetByName('Drop D'), 6)).toEqual([
        'E',
        'B',
        'G',
        'D',
        'A',
        'D',
      ]);
    });

    it('drops the lowest strings for fewer strings', () => {
      expect(getTuningForStrings(presetByName('E Standard'), 4)).toEqual([
        'E',
        'B',
        'G',
        'D',
      ]);
    });

    it('adds strings a fourth below the lowest for extended range', () => {
      expect(getTuningForStrings(presetByName('E Standard'), 7)).toEqual([
        'E',
        'B',
        'G',
        'D',
        'A',
        'E',
        'B',
      ]);
      expect(getTuningForStrings(presetByName('E Standard'), 8)).toEqual([
        'E',
        'B',
        'G',
        'D',
        'A',
        'E',
        'B',
        'F#',
      ]);
    });
  });

  describe('findMatchingPreset', () => {
    it('finds an exact match', () => {
      expect(findMatchingPreset(['E', 'B', 'G', 'D', 'A', 'D'])?.name).toEqual(
        'Drop D',
      );
      expect(findMatchingPreset(['D', 'A', 'F', 'C', 'G', 'C'])?.name).toEqual(
        'Drop C',
      );
    });

    it('matches enharmonic spellings', () => {
      expect(
        findMatchingPreset(['D#', 'A#', 'F#', 'C#', 'G#', 'D#'])?.name,
      ).toEqual('Eb Standard');
    });

    it('matches expanded tunings for other string counts', () => {
      expect(findMatchingPreset(['E', 'B', 'G', 'D'])?.name).toEqual(
        'E Standard',
      );
      expect(
        findMatchingPreset(['E', 'B', 'G', 'D', 'A', 'E', 'B'])?.name,
      ).toEqual('E Standard');
    });

    it('returns undefined for custom tunings', () => {
      expect(
        findMatchingPreset(['E', 'B', 'G', 'D', 'A', 'C']),
      ).toBeUndefined();
      expect(findMatchingPreset(['E', 'B', 'G', 'D', 'A', ''])).toBeUndefined();
    });
  });
});
