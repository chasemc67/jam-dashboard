const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { findSecrets, withoutSecrets } = require('../secret-scan.cjs');

const key = `vck_${'T3s7K3y9'.repeat(5)}`;

test('flags AI Gateway keys and env secret values in build output', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jam-scan-'));
  try {
    await mkdir(path.join(dir, 'assets'));
    await writeFile(path.join(dir, 'assets', 'clean.js'), 'const vck_ = 1;');
    await writeFile(path.join(dir, 'assets', 'leak.js'), `x="${key}"`);
    await writeFile(path.join(dir, 'oidc.cjs'), 'token=abcdefghijklmnopqrstuvwxyz');
    const findings = await findSecrets([dir], {
      VERCEL_OIDC_TOKEN: 'abcdefghijklmnopqrstuvwxyz',
    });
    assert.deepEqual(
      findings.map(f => [path.relative(dir, f.file), f.reason]),
      [
        [path.join('assets', 'leak.js'), 'contains an AI Gateway key'],
        ['oidc.cjs', 'contains the value of VERCEL_OIDC_TOKEN'],
      ],
    );
    assert.ok(!JSON.stringify(findings).includes(key));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('build child processes do not inherit Gateway credentials', () => {
  assert.deepEqual(
    withoutSecrets({ PATH: '/bin', AI_GATEWAY_API_KEY: key, VERCEL_OIDC_TOKEN: 'x' }),
    { PATH: '/bin' },
  );
});
