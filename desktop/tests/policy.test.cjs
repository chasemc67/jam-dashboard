const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  assetPath,
  isAppURL,
  isExternalURL,
  contentSecurityPolicy,
} = require('../policy.cjs');

test('only the bundled origin is trusted', () => {
  assert.equal(isAppURL('jam://dashboard/listen'), true);
  for (const url of [
    'https://dashboard/',
    'jam://evil/',
    'jam://dashboard.evil/',
    'jam://user@dashboard/',
    'jam://dashboard:80/',
    'invalid',
  ]) {
    assert.equal(isAppURL(url), false, url);
  }
});

test('routes reload locally and assets remain inside the renderer directory', () => {
  const root = path.resolve('/tmp/jam-renderer');
  for (const route of ['', 'listen', 'theme/']) {
    assert.equal(
      assetPath(`jam://dashboard/${route}`, root),
      path.join(root, 'index.html'),
    );
  }
  assert.equal(
    assetPath('jam://dashboard/assets/app.js', root),
    path.join(root, 'assets/app.js'),
  );
  for (const url of [
    'jam://evil/index.html',
    'jam://dashboard/%2e%2e%2fsecret',
    'jam://dashboard/%00',
    'jam://dashboard/%5csecret',
    'jam://dashboard/%ZZ',
  ]) {
    assert.equal(assetPath(url, root), null, url);
  }
});

test('external links cannot launch arbitrary OS protocols', () => {
  assert.equal(isExternalURL('https://jamdashboard.com'), true);
  for (const url of [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'someapp://launch',
    'invalid',
  ]) {
    assert.equal(isExternalURL(url), false);
  }
});

test('CSP trusts exact hydration scripts without allowing arbitrary inline JS', () => {
  const csp = contentSecurityPolicy('<script>window.test=1;</script>');
  assert.match(csp, /script-src 'self' blob: 'sha256-/);
  assert.doesNotMatch(csp.split(';')[1], /unsafe-inline|unsafe-eval/);
  assert.match(csp, /connect-src 'self'/);
  assert.notEqual(
    csp,
    contentSecurityPolicy('<script>window.test=2;</script>'),
  );
});
