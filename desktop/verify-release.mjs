import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const { isDeveloperIdSigned } = createRequire(import.meta.url)('./updater.cjs');

export const ARCHES = ['arm64', 'x64'];
const APP = 'Jam Dashboard.app';
const appDirectory = { arm64: 'mac-arm64', x64: 'mac' };
const machO = { arm64: 'arm64', x64: 'x86_64' };

export function checkFeed(feed, { version, arches = ARCHES }) {
  const errors = [];
  if (feed?.version !== version)
    errors.push(
      `latest-mac.yml version is ${feed?.version}, expected ${version}`,
    );
  const files = Array.isArray(feed?.files) ? feed.files : [];
  for (const arch of arches) {
    const name = `Jam-Dashboard-${version}-${arch}.zip`;
    if (!files.some(file => file.url === name && file.sha512 && file.size > 0))
      errors.push(`latest-mac.yml has no ${name} entry`);
  }
  return errors;
}

function sha512(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    createReadStream(file)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('base64')));
  });
}

// codesign and friends report on stderr and signal failure with exit codes.
function tool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`,
  };
}
const signatureOf = file =>
  tool('/usr/bin/codesign', ['-dv', '--verbose=2', file]).output;

async function verify({ directory, version, signed }) {
  const errors = [];
  const feedFile = path.join(directory, 'latest-mac.yml');
  if (!existsSync(feedFile)) return [`${feedFile} is missing`];
  const feed = yaml.load(readFileSync(feedFile, 'utf8'));
  errors.push(...checkFeed(feed, { version }));
  for (const entry of feed?.files ?? []) {
    const file = path.join(directory, entry.url);
    if (!existsSync(file)) {
      errors.push(`${entry.url} is listed in latest-mac.yml but missing`);
      continue;
    }
    if (statSync(file).size !== entry.size)
      errors.push(`${entry.url} size does not match latest-mac.yml`);
    if ((await sha512(file)) !== entry.sha512)
      errors.push(`${entry.url} sha512 does not match latest-mac.yml`);
  }
  for (const arch of ARCHES) {
    const dmg = path.join(directory, `Jam-Dashboard-${version}-${arch}.dmg`);
    if (!existsSync(dmg)) errors.push(`${path.basename(dmg)} is missing`);
    if (process.platform !== 'darwin') continue;

    const app = path.join(directory, appDirectory[arch], APP);
    const helper = path.join(app, 'Contents/Resources/MusicAnalyzerCLI');
    if (!existsSync(path.join(app, 'Contents/Resources/app-update.yml')))
      errors.push(`${arch}: app-update.yml is missing`);
    for (const binary of [
      path.join(app, 'Contents/MacOS/Jam Dashboard'),
      helper,
    ]) {
      const archs = tool('/usr/bin/lipo', ['-archs', binary]).output.trim();
      if (archs !== machO[arch])
        errors.push(`${arch}: ${path.basename(binary)} is "${archs}"`);
    }
    if (!signed) continue;
    for (const [label, args] of [
      [
        'codesign',
        ['/usr/bin/codesign', '--verify', '--deep', '--strict', app],
      ],
      ['Gatekeeper', ['/usr/sbin/spctl', '--assess', '--type', 'execute', app]],
      ['stapled ticket', ['/usr/bin/xcrun', 'stapler', 'validate', app]],
    ]) {
      const result = tool(args[0], args.slice(1));
      if (!result.ok)
        errors.push(`${arch}: ${label} check failed\n${result.output}`);
    }
    for (const file of [app, helper])
      if (!isDeveloperIdSigned(signatureOf(file)))
        errors.push(
          `${arch}: ${path.basename(file)} is not Developer ID signed`,
        );
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => args[args.indexOf(name) + 1];
  const version = option('--version');
  const signed = option('--signed') === 'true';
  if (!args.includes('--version') || !version)
    throw new Error(
      'Usage: node desktop/verify-release.mjs --version <semver> [--signed true|false] [--dir release]',
    );
  const directory = args.includes('--dir') ? option('--dir') : 'release';
  const errors = await verify({ directory, version, signed });
  if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    process.exit(1);
  }
  console.log(
    `✓ ${version}: latest-mac.yml lists ${ARCHES.join(' + ')} zips with matching hashes` +
      (signed
        ? '; apps are Developer ID signed, notarized, and stapled'
        : ' (unsigned)'),
  );
}
