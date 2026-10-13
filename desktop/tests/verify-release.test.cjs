const { test } = require('node:test');
const assert = require('node:assert/strict');

const entry = url => ({ url, sha512: 'hash', size: 1 });

for (const successOn of [1, 2, 4, Infinity]) {
  test(`ticket validation retries failures only (success on attempt ${successOn})`, async () => {
    const { validateStapledTicket } = await import('../verify-release.mjs');
    let attempts = 0;
    const delays = [];
    const result = await validateStapledTicket('/tmp/Jam Dashboard.app', {
      run: (command, args) => {
        attempts += 1;
        assert.equal(command, '/usr/bin/xcrun');
        assert.deepEqual(args, [
          'stapler',
          'validate',
          '/tmp/Jam Dashboard.app',
        ]);
        return {
          ok: attempts === successOn,
          output: `attempt ${attempts}: Error 68`,
        };
      },
      sleep: async ms => delays.push(ms),
    });
    assert.equal(attempts, Math.min(successOn, 4));
    assert.deepEqual(delays, [20_000, 40_000, 60_000].slice(0, attempts - 1));
    assert.deepEqual(result, {
      ok: successOn !== Infinity,
      output: `attempt ${attempts}: Error 68`,
    });
  });
}

test('the update feed must list the arm64 zip for the release version', async () => {
  const { checkFeed } = await import('../verify-release.mjs');
  const version = '0.1.42';
  assert.deepEqual(
    checkFeed(
      {
        version,
        files: [
          entry('Jam-Dashboard-0.1.42-arm64.zip'),
          entry('Jam-Dashboard-0.1.42-arm64.dmg'),
        ],
      },
      { version },
    ),
    [],
  );
  assert.deepEqual(
    checkFeed(
      { version, files: [entry('Jam-Dashboard-0.1.42-arm64.dmg')] },
      { version },
    ),
    ['latest-mac.yml has no Jam-Dashboard-0.1.42-arm64.zip entry'],
  );
  assert.deepEqual(checkFeed({ version: '0.1.41', files: [] }, { version }), [
    'latest-mac.yml version is 0.1.41, expected 0.1.42',
    'latest-mac.yml has no Jam-Dashboard-0.1.42-arm64.zip entry',
  ]);
});
