const { test } = require('node:test');
const assert = require('node:assert/strict');

const entry = url => ({ url, sha512: 'hash', size: 1 });

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
