import {
  HAND_CUTOUT_KEY,
  HAND_OPACITY_KEY,
  HAND_ALPHA_GLSL,
  handOpacity,
  HAND_OPTION_KEY,
  storedHandSettings,
  handMaskTransform,
} from './handCutout';

test('cutout defaults off and restores the selected option separately', () => {
  expect(storedHandSettings(null, null)).toEqual({
    enabled: false,
    option: 'skin',
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
    option: 'skin',
  });
});

test.each(['true', 'false'])(
  'saved Vision fast is preserved with cutout %s',
  enabled => {
    localStorage.setItem(HAND_CUTOUT_KEY, enabled);
    localStorage.setItem(HAND_OPTION_KEY, 'vision-fast');
    expect(
      storedHandSettings(
        localStorage.getItem(HAND_CUTOUT_KEY),
        localStorage.getItem(HAND_OPTION_KEY),
      ),
    ).toEqual({ enabled: enabled === 'true', option: 'vision-fast' });
  },
);

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

test.each([null, '', ' ', 'bad', 'NaN', 'Infinity'])(
  'opacity defaults to 100 for %s',
  value => {
    expect(handOpacity(value)).toBe(100);
  },
);
test.each([
  ['-10', 0],
  ['150', 100],
  ['0', 0],
  ['50', 50],
  ['100', 100],
])('opacity clamps/restores %s', (value, expected) => {
  localStorage.setItem(HAND_OPACITY_KEY, value);
  expect(handOpacity(localStorage.getItem(HAND_OPACITY_KEY))).toBe(expected);
});
test.each([
  [100, 1, 0],
  [50, 1, 0.5],
  [0, 1, 1],
  [100, 0, 1],
  [50, 0.4, 0.8],
])(
  'shader opacity %s and mask %s leave alpha %s',
  (opacity, mask, expected) => {
    const shaderMath = new Function(
      'u_handOpacity',
      'handAlpha',
      `return ${HAND_ALPHA_GLSL};`,
    );
    expect(shaderMath(opacity / 100, mask)).toBeCloseTo(expected);
  },
);
