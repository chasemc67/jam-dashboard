const { test } = require('node:test');
const assert = require('node:assert/strict');
const { require: tsRequire } = require('tsx/cjs/api');
const { storedHandSettings } = tsRequire(
  '../../app/components/LiveFretboard/handCutout.ts',
  __filename,
);

test('hand cutout defaults to skin while remaining disabled', () => {
  assert.deepEqual(storedHandSettings(null, null), {
    enabled: false,
    option: 'skin',
  });
  assert.deepEqual(storedHandSettings('true', null), {
    enabled: true,
    option: 'skin',
  });
});

test('saved hand cutout methods win regardless of the toggle state', () => {
  for (const enabled of [null, 'false', 'true']) {
    for (const option of ['vision-fast', 'vision-balanced', 'skin']) {
      assert.deepEqual(storedHandSettings(enabled, option), {
        enabled: enabled === 'true',
        option,
      });
    }
  }
});

test('invalid saved method falls back to skin without changing the toggle', () => {
  for (const enabled of ['false', 'true']) {
    assert.deepEqual(storedHandSettings(enabled, 'removed'), {
      enabled: enabled === 'true',
      option: 'skin',
    });
  }
});
