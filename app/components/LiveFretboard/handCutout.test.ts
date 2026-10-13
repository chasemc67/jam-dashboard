import {
  HAND_CUTOUT_KEY,
  HAND_OPTION_KEY,
  storedHandSettings,
  handMaskTransform,
} from './handCutout';

test('cutout defaults off and restores the selected option separately', () => {
  expect(storedHandSettings(null, null)).toEqual({
    enabled: false,
    option: 'vision-fast',
  });
  localStorage.setItem(HAND_CUTOUT_KEY, 'true');
  localStorage.setItem(HAND_OPTION_KEY, 'vision-balanced');
  expect(
    storedHandSettings(
      localStorage.getItem(HAND_CUTOUT_KEY),
      localStorage.getItem(HAND_OPTION_KEY),
    ),
  ).toEqual({ enabled: true, option: 'vision-balanced' });
  expect(storedHandSettings('false', 'skin')).toEqual({
    enabled: false,
    option: 'skin',
  });
  expect(storedHandSettings('bad', 'removed')).toEqual({
    enabled: false,
    option: 'vision-fast',
  });
});

test.each([640, 832])(
  'mask UV crops landscape letterbox at %i, applying both flips once',
  size => {
    for (const model of [false, true])
      for (const display of [false, true]) {
        const [sx, sy, tx, ty] = handMaskTransform(
          1920,
          1080,
          size,
          model,
          display,
        );
        expect(sy).toBeCloseTo(0.5625);
        expect(ty).toBeCloseTo(0.21875);
        expect(sx * 0.25 + tx).toBeCloseTo(model !== display ? 0.75 : 0.25);
        expect(sy * 0.5 + ty).toBeCloseTo(0.5);
      }
  },
);

test('portrait padding is horizontal and square input has none', () => {
  expect(handMaskTransform(640, 640, 640, false, false)).toEqual([1, 1, 0, 0]);
  expect(handMaskTransform(1080, 1920, 640, false, false)).toEqual([
    0.5625, 1, 0.21875, 0,
  ]);
});
