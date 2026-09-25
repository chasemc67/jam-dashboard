const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  credentials,
  timeoutMinutes,
  waitForNotarization,
} = require('../notarize.cjs');
const builderConfig = require('../electron-builder.json');

const MINUTE = 60_000;

function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async ms => {
      time += ms;
    },
  };
}

function poller(statuses) {
  const calls = [];
  return {
    calls,
    info: async id => {
      calls.push(id);
      const next = statuses.shift();
      if (next instanceof Error) throw next;
      return typeof next === 'string' ? { id, status: next } : { id, ...next };
    },
  };
}

const quiet = () => {};

test('the builder skips its unbounded notarytool wait and runs the hook', () => {
  assert.equal(builderConfig.mac.notarize, false);
  assert.equal(builderConfig.afterSign, './desktop/notarize.cjs');
});

test('credentials prefer the API key and require complete sets', () => {
  const api = {
    APPLE_API_KEY: '/tmp/AuthKey.p8',
    APPLE_API_KEY_ID: 'KEY',
    APPLE_API_ISSUER: 'ISSUER',
  };
  const appleId = {
    APPLE_ID: 'me@example.com',
    APPLE_APP_SPECIFIC_PASSWORD: 'pw',
    APPLE_TEAM_ID: 'TEAM',
  };
  assert.deepEqual(credentials({ ...api, ...appleId }), [
    '--key',
    '/tmp/AuthKey.p8',
    '--key-id',
    'KEY',
    '--issuer',
    'ISSUER',
  ]);
  assert.deepEqual(credentials(appleId), [
    '--apple-id',
    'me@example.com',
    '--password',
    'pw',
    '--team-id',
    'TEAM',
  ]);
  assert.equal(credentials({ APPLE_API_KEY_ID: 'KEY' }), null);
  assert.equal(credentials({}), null);
});

test('the timeout defaults to 20 minutes and rejects nonsense', () => {
  assert.equal(timeoutMinutes({}), 20);
  assert.equal(timeoutMinutes({ JAM_NOTARIZE_TIMEOUT_MINUTES: '15' }), 15);
  assert.throws(() => timeoutMinutes({ JAM_NOTARIZE_TIMEOUT_MINUTES: '0' }));
  assert.throws(() => timeoutMinutes({ JAM_NOTARIZE_TIMEOUT_MINUTES: 'x' }));
});

test('polling resolves once Apple accepts the submission', async () => {
  const { info, calls } = poller(['In Progress', 'In Progress', 'Accepted']);
  const result = await waitForNotarization('abc', {
    info,
    timeoutMs: 20 * MINUTE,
    report: quiet,
    ...fakeClock(),
  });
  assert.equal(result.status, 'Accepted');
  assert.deepEqual(calls, ['abc', 'abc', 'abc']);
});

test('Invalid fails immediately with the status message', async () => {
  const { info, calls } = poller([
    'In Progress',
    { status: 'Invalid', message: 'Processing complete' },
  ]);
  await assert.rejects(
    waitForNotarization('abc', {
      info,
      timeoutMs: 20 * MINUTE,
      report: quiet,
      ...fakeClock(),
    }),
    /Apple returned Invalid for submission abc: Processing complete/,
  );
  assert.equal(calls.length, 2);
});

test('a submission stuck in progress fails at the deadline', async () => {
  const clock = fakeClock();
  const { info, calls } = poller(Array(100).fill('In Progress'));
  await assert.rejects(
    waitForNotarization('abc', {
      info,
      timeoutMs: 20 * MINUTE,
      intervalMs: 30_000,
      report: quiet,
      ...clock,
    }),
    /did not finish within 20 minutes \(last status: In Progress\).*notarytool info abc/,
  );
  assert.ok(clock.now() <= 20 * MINUTE);
  assert.equal(calls.length, 41);
});

test('transient status-check errors are retried, repeated ones fail', async () => {
  const flaky = poller([new Error('network'), 'In Progress', 'Accepted']);
  await waitForNotarization('abc', {
    info: flaky.info,
    timeoutMs: 20 * MINUTE,
    report: quiet,
    ...fakeClock(),
  });
  assert.equal(flaky.calls.length, 3);

  const broken = poller(Array(5).fill(new Error('network')));
  await assert.rejects(
    waitForNotarization('abc', {
      info: broken.info,
      timeoutMs: 20 * MINUTE,
      maxFailures: 5,
      report: quiet,
      ...fakeClock(),
    }),
    /Gave up on submission abc after 5 failed status checks: network/,
  );
});
