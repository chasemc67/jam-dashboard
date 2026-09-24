const { execFile } = require('node:child_process');
const { appendFile, mkdir } = require('node:fs/promises');
const path = require('node:path');

const RELEASES_URL =
  'https://github.com/chasemc67/jam-dashboard/releases/latest';
const STARTUP_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const OFFLINE_CODES = [
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_NETWORK_CHANGED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_PROXY_CONNECTION_FAILED',
];
const NO_RELEASE_CODES = [
  // Thrown without a code when a repository has no releases at all.
  'No published versions',
  'ERR_UPDATER_NO_PUBLISHED_VERSIONS',
  'ERR_UPDATER_LATEST_VERSION_NOT_FOUND',
  'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
];

function createLogger(
  file,
  { write = appendFile, makeDirectory = mkdir, console: out = console } = {},
) {
  let queue = makeDirectory(path.dirname(file), { recursive: true }).catch(
    () => {},
  );
  const line = (level, args) =>
    `${new Date().toISOString()} [${level}] ${args
      .map(arg =>
        arg instanceof Error ? arg.stack || arg.message : String(arg),
      )
      .join(' ')}\n`;
  const logger = {};
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level] = (...args) => {
      if (level !== 'debug') out[level]('[updater]', ...args);
      const text = line(level, args);
      queue = queue.then(() => write(file, text)).catch(() => {});
    };
  }
  logger.flush = () => queue;
  return logger;
}

// Squirrel.Mac only installs an update whose signature satisfies the running
// app's designated requirement, which ad-hoc and unsigned builds never do.
function isDeveloperIdSigned(codesignOutput) {
  return (
    /^Authority=Developer ID Application: /m.test(codesignOutput) &&
    /^TeamIdentifier=(?!not set)\S+/m.test(codesignOutput)
  );
}

function appBundlePath(execPath) {
  return path.resolve(path.dirname(execPath), '..', '..');
}

function readCodeSignature(bundle, run = execFile) {
  return new Promise(resolve => {
    run(
      '/usr/bin/codesign',
      ['-dv', '--verbose=2', bundle],
      (_error, stdout, stderr) => resolve(`${stdout ?? ''}${stderr ?? ''}`),
    );
  });
}

function describeUpdateError(error, action = 'checking for updates') {
  const text = `${error?.code ?? ''} ${error?.message ?? error ?? ''}`;
  if (
    NO_RELEASE_CODES.some(code => text.includes(code)) ||
    /\b404\b/.test(text)
  )
    return 'No published release was found yet. Try again later.';
  if (OFFLINE_CODES.some(code => text.includes(code)))
    return 'GitHub could not be reached. Check your internet connection and try again.';
  return `Something went wrong while ${action}. Try again later.`;
}

function createUpdater({
  autoUpdater,
  dialog,
  shell,
  getWindow = () => undefined,
  currentVersion,
  canSelfUpdate,
  log,
  releasesURL = RELEASES_URL,
  startupDelay = STARTUP_DELAY_MS,
  interval = CHECK_INTERVAL_MS,
  timers = { setTimeout, setInterval },
}) {
  let pending;
  let interactive = false;
  let downloadedVersion;
  let prompting = false;
  const notified = new Set();

  autoUpdater.logger = log;
  autoUpdater.autoDownload = canSelfUpdate;
  autoUpdater.autoInstallOnAppQuit = canSelfUpdate;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  const show = options => {
    const window = getWindow();
    return window && !window.isDestroyed()
      ? dialog.showMessageBox(window, options)
      : dialog.showMessageBox(options);
  };

  async function promptRestart() {
    if (prompting) return;
    prompting = true;
    try {
      const { response } = await show({
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: `Jam Dashboard ${downloadedVersion} is ready to install`,
        detail:
          'Restart now to finish updating, or it will install the next time you quit.',
      });
      if (response === 0) {
        log.info(`Restarting to install ${downloadedVersion}`);
        autoUpdater.quitAndInstall();
      }
    } finally {
      prompting = false;
    }
  }

  async function offerDownload(version) {
    const { response } = await show({
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: `Jam Dashboard ${version} is available`,
      detail: `You have ${currentVersion}. This copy isn't signed with a Developer ID, so it can't update itself. Download the new version from GitHub Releases.`,
    });
    if (response === 0) await shell.openExternal(releasesURL);
  }

  autoUpdater.on('update-available', info => {
    log.info(`Update available: ${info.version} (current ${currentVersion})`);
    if (!canSelfUpdate) {
      if (interactive || !notified.has(info.version)) {
        notified.add(info.version);
        offerDownload(info.version).catch(error => log.error(error));
      }
    } else if (interactive) {
      show({
        type: 'info',
        message: `Downloading Jam Dashboard ${info.version}`,
        detail: "You'll be asked to restart when it's ready.",
      }).catch(error => log.error(error));
    }
  });
  autoUpdater.on('update-not-available', info => {
    log.info(`Up to date (current ${currentVersion}, latest ${info?.version})`);
    if (interactive)
      show({
        type: 'info',
        message: "You're up to date",
        detail: `Jam Dashboard ${currentVersion} is the latest version.`,
      }).catch(error => log.error(error));
  });
  autoUpdater.on('update-downloaded', info => {
    log.info(`Update downloaded: ${info.version}`);
    downloadedVersion = info.version;
    promptRestart().catch(error => log.error(error));
  });

  async function run() {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.downloadPromise) {
        const wasInteractive = interactive;
        // The failure is also emitted as an `error` event, which is logged.
        result.downloadPromise.catch(error => {
          if (wasInteractive)
            show({
              type: 'warning',
              message: "The update couldn't be downloaded",
              detail: describeUpdateError(error, 'downloading the update'),
            }).catch(nested => log.error(nested));
        });
      }
    } catch (error) {
      log.warn('Update check failed:', describeUpdateError(error));
      if (interactive)
        await show({
          type: 'warning',
          message: "Couldn't check for updates",
          detail: describeUpdateError(error),
        }).catch(nested => log.error(nested));
    }
  }

  async function check({ interactive: fromUser = false } = {}) {
    // A background check reports nothing, so a menu click waits and asks again.
    while (pending) {
      if (!fromUser || interactive) return pending;
      await pending;
    }
    if (downloadedVersion) return fromUser ? promptRestart() : undefined;
    interactive = fromUser;
    pending = run().finally(() => {
      pending = undefined;
      interactive = false;
    });
    return pending;
  }

  function start() {
    log.info(
      `Updater started for ${currentVersion} (${canSelfUpdate ? 'automatic install' : 'notify only: not Developer ID signed'})`,
    );
    const background = () => check().catch(error => log.error(error));
    timers.setTimeout(background, startupDelay);
    timers.setInterval(background, interval);
  }

  return { check, start };
}

module.exports = {
  RELEASES_URL,
  appBundlePath,
  createLogger,
  createUpdater,
  describeUpdateError,
  isDeveloperIdSigned,
  readCodeSignature,
};
