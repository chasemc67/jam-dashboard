const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  RELEASES_URL,
  appBundlePath,
  createLogger,
  createUpdater,
  describeUpdateError,
  isDeveloperIdSigned,
  readCodeSignature,
} = require('../updater.cjs');

const silent = { debug() {}, info() {}, warn() {}, error() {} };
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ canSelfUpdate = true, check, responses = [] } = {}) {
  const autoUpdater = new EventEmitter();
  autoUpdater.checks = 0;
  autoUpdater.installs = 0;
  autoUpdater.checkForUpdates = async () => {
    autoUpdater.checks += 1;
    return check ? check(autoUpdater) : null;
  };
  autoUpdater.quitAndInstall = () => {
    autoUpdater.installs += 1;
  };
  const dialogs = [];
  const opened = [];
  const timers = [];
  const updater = createUpdater({
    autoUpdater,
    dialog: {
      showMessageBox: async (...args) => {
        const options = args.at(-1);
        dialogs.push(options);
        return { response: responses.shift() ?? 1 };
      },
    },
    shell: { openExternal: async url => opened.push(url) },
    currentVersion: '0.1.10',
    canSelfUpdate,
    log: silent,
    timers: {
      setTimeout: (fn, ms) => timers.push(['timeout', ms, fn]),
      setInterval: (fn, ms) => timers.push(['interval', ms, fn]),
    },
  });
  return { autoUpdater, updater, dialogs, opened, timers };
}

test('only Developer ID signatures allow Squirrel.Mac installs', () => {
  const signed = [
    'Executable=/Applications/Jam Dashboard.app/Contents/MacOS/Jam Dashboard',
    'Authority=Developer ID Application: Chase McMahon (ABCDE12345)',
    'Authority=Developer ID Certification Authority',
    'TeamIdentifier=ABCDE12345',
  ].join('\n');
  assert.equal(isDeveloperIdSigned(signed), true);
  assert.equal(
    isDeveloperIdSigned('Signature=adhoc\nTeamIdentifier=not set'),
    false,
  );
  assert.equal(
    isDeveloperIdSigned(
      'Authority=Apple Development: Chase (XYZ)\nTeamIdentifier=ABCDE12345',
    ),
    false,
  );
  assert.equal(isDeveloperIdSigned('code object is not signed at all'), false);
});

test('codesign output is read from the enclosing .app bundle', async () => {
  assert.equal(
    appBundlePath(
      '/Applications/Jam Dashboard.app/Contents/MacOS/Jam Dashboard',
    ),
    '/Applications/Jam Dashboard.app',
  );
  const calls = [];
  const output = await readCodeSignature(
    '/Applications/Jam Dashboard.app',
    (cmd, args, done) => {
      calls.push([cmd, ...args]);
      done(new Error('exit 1'), '', 'TeamIdentifier=not set\n');
    },
  );
  assert.deepEqual(calls, [
    [
      '/usr/bin/codesign',
      '-dv',
      '--verbose=2',
      '/Applications/Jam Dashboard.app',
    ],
  ]);
  assert.equal(output, 'TeamIdentifier=not set\n');
});

test('update errors become short, fail-soft messages', () => {
  assert.match(
    describeUpdateError(
      Object.assign(new Error('x'), {
        code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND',
      }),
    ),
    /No published release/,
  );
  assert.match(
    describeUpdateError(new Error('HttpError: 404 Not Found')),
    /No published release/,
  );
  assert.match(
    describeUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED')),
    /internet connection/,
  );
  assert.match(
    describeUpdateError(new Error('getaddrinfo ENOTFOUND github.com')),
    /internet connection/,
  );
  assert.equal(
    describeUpdateError(new Error('boom'), 'downloading the update'),
    'Something went wrong while downloading the update. Try again later.',
  );
});

test('start schedules a delayed first check and a periodic check', async () => {
  const { autoUpdater, updater, timers } = harness();
  assert.equal(autoUpdater.autoDownload, true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  assert.equal(autoUpdater.allowPrerelease, false);
  updater.start();
  assert.deepEqual(
    timers.map(([kind, ms]) => [kind, ms]),
    [
      ['timeout', 10_000],
      ['interval', 4 * 60 * 60 * 1000],
    ],
  );
  await timers[0][2]();
  assert.equal(autoUpdater.checks, 1);
});

test('background checks stay silent when up to date or offline', async () => {
  const upToDate = harness({
    check: au => au.emit('update-not-available', { version: '0.1.10' }),
  });
  await upToDate.updater.check();
  assert.equal(upToDate.dialogs.length, 0);

  const offline = harness({
    check: () => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED');
    },
  });
  await offline.updater.check();
  assert.equal(offline.dialogs.length, 0);
});

test('menu checks report up to date and failures', async () => {
  const upToDate = harness({
    check: au => au.emit('update-not-available', { version: '0.1.10' }),
  });
  await upToDate.updater.check({ interactive: true });
  assert.equal(upToDate.dialogs[0].message, "You're up to date");

  const noRelease = harness({
    check: () => {
      throw Object.assign(new Error('none'), {
        code: 'ERR_UPDATER_NO_PUBLISHED_VERSIONS',
      });
    },
  });
  await noRelease.updater.check({ interactive: true });
  assert.equal(noRelease.dialogs[0].message, "Couldn't check for updates");
  assert.match(noRelease.dialogs[0].detail, /No published release/);
});

test('signed builds download, then offer a restart that installs', async () => {
  const { autoUpdater, updater, dialogs } = harness({
    responses: [undefined, 0],
    check: au => {
      au.emit('update-available', { version: '0.1.42' });
      const downloadPromise = Promise.resolve().then(() =>
        au.emit('update-downloaded', { version: '0.1.42' }),
      );
      return { downloadPromise };
    },
  });
  await updater.check({ interactive: true });
  await tick();
  assert.deepEqual(
    dialogs.map(d => d.message),
    [
      'Downloading Jam Dashboard 0.1.42',
      'Jam Dashboard 0.1.42 is ready to install',
    ],
  );
  assert.deepEqual(dialogs[1].buttons, ['Restart Now', 'Later']);
  assert.equal(autoUpdater.installs, 1);
});

test('choosing Later defers install; the menu asks again without re-downloading', async () => {
  const { autoUpdater, updater, dialogs } = harness({
    responses: [1, 0],
    check: au => {
      au.emit('update-downloaded', { version: '0.1.42' });
      return null;
    },
  });
  await updater.check();
  await tick();
  assert.equal(autoUpdater.installs, 0);
  await updater.check({ interactive: true });
  assert.equal(autoUpdater.checks, 1);
  assert.equal(dialogs.length, 2);
  assert.equal(autoUpdater.installs, 1);
});

test('interactive download failures are reported without unhandled rejections', async () => {
  const { updater, dialogs } = harness({
    check: au => {
      au.emit('update-available', { version: '0.1.42' });
      return {
        downloadPromise: Promise.reject(new Error('sha512 checksum mismatch')),
      };
    },
  });
  await updater.check({ interactive: true });
  await tick();
  assert.equal(dialogs.at(-1).message, "The update couldn't be downloaded");
});

test('unsigned builds link to the release instead of installing, once per version in background', async () => {
  const { autoUpdater, updater, dialogs, opened } = harness({
    canSelfUpdate: false,
    responses: [0],
    check: au => au.emit('update-available', { version: '0.1.42' }),
  });
  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  await updater.check();
  await tick();
  assert.match(dialogs[0].detail, /isn't signed with a Developer ID/);
  assert.deepEqual(opened, [RELEASES_URL]);
  await updater.check();
  await tick();
  assert.equal(dialogs.length, 1);
  await updater.check({ interactive: true });
  await tick();
  assert.equal(dialogs.length, 2);
});

test('a menu click during a background check runs its own visible check', async () => {
  let release;
  let calls = 0;
  const { updater, dialogs } = harness({
    check: async au => {
      calls += 1;
      if (calls === 1) await new Promise(resolve => (release = resolve));
      au.emit('update-not-available', { version: '0.1.10' });
    },
  });
  const background = updater.check();
  await tick();
  const fromMenu = updater.check({ interactive: true });
  const again = updater.check({ interactive: true });
  release();
  await Promise.all([background, fromMenu, again]);
  assert.equal(calls, 2);
  assert.deepEqual(
    dialogs.map(d => d.message),
    ["You're up to date"],
  );
});

test('the logger creates its directory and appends timestamped lines in order', async () => {
  const writes = [];
  const made = [];
  const log = createLogger('/logs/Jam Dashboard/updater.log', {
    makeDirectory: async (dir, options) => made.push([dir, options]),
    write: async (file, text) => writes.push([file, text]),
    console: silent,
  });
  log.info('one');
  log.error(new Error('two'));
  await log.flush();
  assert.deepEqual(made, [['/logs/Jam Dashboard', { recursive: true }]]);
  assert.equal(writes.length, 2);
  assert.match(writes[0][1], /^\d{4}-\d\d-\d\dT.* \[info\] one\n$/);
  assert.match(writes[1][1], /\[error\] Error: two/);
});
