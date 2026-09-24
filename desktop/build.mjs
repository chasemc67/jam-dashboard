import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import builder from 'electron-builder';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const allowed = new Set(['--package', '--arm64', '--x64', '--dir']);
if (process.platform !== 'darwin' || args.some(arg => !allowed.has(arg))) {
  throw new Error(
    'Build on macOS. Usage: node desktop/build.mjs [--package] [--arm64] [--x64] [--dir]',
  );
}
const requested = ['arm64', 'x64'].filter(arch => args.includes(`--${arch}`));
if (!requested.length) requested.push(process.arch);
if (requested.some(arch => !['arm64', 'x64'].includes(arch)))
  throw new Error(`Unsupported architecture: ${process.arch}`);
// The unsuffixed helper used by `desktop:start` ends up as the last one built.
const arches = [
  ...requested.filter(arch => arch !== process.arch),
  ...requested.filter(arch => arch === process.arch),
];

const version = process.env.JAM_DESKTOP_VERSION;
if (version && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version))
  throw new Error(
    `JAM_DESKTOP_VERSION must be a semantic version, got "${version}"`,
  );

function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const dist = path.join(root, 'desktop/native/dist');
for (const arch of arches) {
  run('bash', ['desktop/native/scripts/build-helper.sh'], {
    JAM_DESKTOP_ARCH: arch === 'x64' ? 'x86_64' : 'arm64',
  });
  mkdirSync(path.join(dist, arch), { recursive: true });
  copyFileSync(
    path.join(dist, 'MusicAnalyzerCLI'),
    path.join(dist, arch, 'MusicAnalyzerCLI'),
  );
}
run('npm', ['run', 'agent:build']);
run('node', ['scripts/build-updater.mjs']);
run('npm', ['run', 'desktop:renderer']);
if (args.includes('--package')) {
  const config = JSON.parse(
    readFileSync(path.join(root, 'desktop/electron-builder.json'), 'utf8'),
  );
  if (version) config.extraMetadata = { ...config.extraMetadata, version };
  await builder.build({
    projectDir: root,
    targets: builder.Platform.MAC.createTarget(
      args.includes('--dir') ? 'dir' : null,
      ...arches.map(arch => builder.Arch[arch]),
    ),
    config,
    publish: 'never',
  });
}
