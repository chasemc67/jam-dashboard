const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// electron-builder's built-in notarization runs `notarytool submit --wait`,
// which has hung in CI long after Apple accepted the submission
// (electron/notarize#179). This hook submits without waiting and polls with a
// deadline so a stuck wait fails the job instead of eating its whole timeout.

const MINUTE = 60_000;
const DEFAULT_TIMEOUT_MINUTES = 20;
const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_FAILURES = 5;
const PENDING = 'In Progress';

const verbose = () => /notarize/.test(process.env.DEBUG ?? '');
const log = message => console.log(`  • notarize: ${message}`);

/** notarytool auth args; the API key wins when both sets are present. */
function credentials(env = process.env) {
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER)
    return [
      '--key',
      env.APPLE_API_KEY,
      '--key-id',
      env.APPLE_API_KEY_ID,
      '--issuer',
      env.APPLE_API_ISSUER,
    ];
  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
    return [
      '--apple-id',
      env.APPLE_ID,
      '--password',
      env.APPLE_APP_SPECIFIC_PASSWORD,
      '--team-id',
      env.APPLE_TEAM_ID,
    ];
  return null;
}

function timeoutMinutes(env = process.env) {
  const raw = env.JAM_NOTARIZE_TIMEOUT_MINUTES;
  if (raw == null || raw === '') return DEFAULT_TIMEOUT_MINUTES;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0)
    throw new Error(
      `JAM_NOTARIZE_TIMEOUT_MINUTES must be a positive number, got "${raw}"`,
    );
  return minutes;
}

// Commands are killed outright on timeout so no orphaned notarytool outlives
// the build. Auth args are never echoed.
function exec(command, args, { timeoutMs, label, cwd }) {
  return new Promise((resolve, reject) => {
    // Its own process group, so a timeout also kills what xcrun spawned.
    const child = spawn(command, args, { cwd, detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut)
        reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
      else resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseJson(label, { code, stdout, stderr }) {
  if (verbose()) log(`${label} output (exit ${code}): ${stdout.trim()}`);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(
      `${label} exited ${code} without JSON output:\n${stdout}${stderr}`,
    );
  }
}

function notarytool(auth) {
  const run = (subcommand, args, timeoutMs) =>
    exec('xcrun', ['notarytool', subcommand, ...args, ...auth], {
      timeoutMs,
      label: `notarytool ${subcommand}`,
    });
  return {
    async submit(file) {
      const result = await run(
        'submit',
        [file, '--output-format', 'json'],
        20 * MINUTE,
      );
      const parsed = parseJson('notarytool submit', result);
      if (result.code !== 0 || typeof parsed.id !== 'string')
        throw new Error(
          `notarytool submit failed (exit ${result.code}): ${parsed.message ?? JSON.stringify(parsed)}`,
        );
      return parsed.id;
    },
    async info(id) {
      const result = await run(
        'info',
        [id, '--output-format', 'json'],
        2 * MINUTE,
      );
      const parsed = parseJson('notarytool info', result);
      // A reported status is authoritative even when the exit code is not 0.
      if (typeof parsed.status !== 'string')
        throw new Error(
          `notarytool info exited ${result.code}: ${parsed.message ?? JSON.stringify(parsed)}`,
        );
      return parsed;
    },
    async log(id) {
      const result = await run('log', [id], 2 * MINUTE);
      return `${result.stdout}${result.stderr}`;
    },
  };
}

/**
 * Polls until Apple reports a final status. Resolves on Accepted; rejects on
 * any other final status, on repeated poll failures, or at the deadline.
 */
async function waitForNotarization(
  id,
  {
    info,
    timeoutMs,
    intervalMs = POLL_INTERVAL_MS,
    maxFailures = MAX_POLL_FAILURES,
    now = Date.now,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    report = log,
  },
) {
  const started = now();
  const deadline = started + timeoutMs;
  const elapsed = () => `${Math.round((now() - started) / 1000)}s`;
  let failures = 0;
  let status = 'unknown';
  for (;;) {
    try {
      const result = await info(id);
      failures = 0;
      status = result.status;
      report(`${id} is ${status} after ${elapsed()}`);
      if (status === 'Accepted') return result;
      if (status !== PENDING)
        throw Object.assign(
          new Error(
            `Apple returned ${status} for submission ${id}${result.message ? `: ${result.message}` : ''}`,
          ),
          { final: true },
        );
    } catch (error) {
      if (error.final) throw error;
      failures += 1;
      report(
        `status check ${failures}/${maxFailures} for ${id} failed: ${error.message}`,
      );
      if (failures >= maxFailures)
        throw new Error(
          `Gave up on submission ${id} after ${failures} failed status checks: ${error.message}`,
        );
    }
    if (now() + intervalMs > deadline)
      throw new Error(
        `Notarization of ${id} did not finish within ${timeoutMs / MINUTE} minutes (last status: ${status}). ` +
          `Check it with: xcrun notarytool info ${id}`,
      );
    await sleep(intervalMs);
  }
}

async function notarizeApp(appPath, { auth, timeoutMs }) {
  const tool = notarytool(auth);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jam-notarize-'));
  try {
    const zip = path.join(dir, `${path.parse(appPath).name}.zip`);
    const zipped = await exec(
      'ditto',
      [
        '-c',
        '-k',
        '--sequesterRsrc',
        '--keepParent',
        path.basename(appPath),
        zip,
      ],
      { timeoutMs: 10 * MINUTE, label: 'ditto', cwd: path.dirname(appPath) },
    );
    if (zipped.code !== 0)
      throw new Error(`ditto exited ${zipped.code}: ${zipped.stderr}`);

    log(`uploading ${path.basename(appPath)} to Apple`);
    const id = await tool.submit(zip);
    log(
      `submitted ${id}; polling every ${POLL_INTERVAL_MS / 1000}s for up to ${timeoutMs / MINUTE} minutes`,
    );
    try {
      await waitForNotarization(id, { info: tool.info, timeoutMs });
    } catch (error) {
      const details = await tool
        .log(id)
        .catch(logError => `(could not fetch log: ${logError.message})`);
      log(`notarytool log ${id}:\n${details}`);
      throw error;
    }

    const stapled = await exec('xcrun', ['stapler', 'staple', appPath], {
      timeoutMs: 5 * MINUTE,
      label: 'stapler staple',
    });
    if (stapled.code !== 0)
      throw new Error(
        `stapler exited ${stapled.code}: ${stapled.stdout}${stapled.stderr}`,
      );
    log(`${id} accepted and stapled`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const auth = credentials();
  if (!auth) {
    log('skipped: no App Store Connect API key or Apple ID credentials');
    return;
  }
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const minutes = timeoutMinutes();
  log(`starting for ${appPath} (timeout ${minutes} minutes)`);
  try {
    await notarizeApp(appPath, { auth, timeoutMs: minutes * MINUTE });
  } catch (error) {
    if (process.env.GITHUB_ACTIONS)
      console.log(
        `::error title=Notarization failed::${error.message.replace(/\n/g, '%0A')}`,
      );
    throw error;
  }
}

module.exports = afterSign;
module.exports.default = afterSign;
Object.assign(module.exports, {
  credentials,
  timeoutMinutes,
  waitForNotarization,
});
