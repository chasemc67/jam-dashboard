import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const allowed = new Set(['--package', '--arm64', '--x64', '--dir']);
if (
  process.platform !== 'darwin' ||
  args.some(arg => !allowed.has(arg)) ||
  (args.includes('--arm64') && args.includes('--x64'))
) {
  throw new Error(
    'Build on macOS. Usage: node desktop/build.mjs [--package] [--arm64 | --x64] [--dir]',
  );
}
const arch = args.includes('--x64')
  ? 'x64'
  : args.includes('--arm64')
    ? 'arm64'
    : process.arch;
if (!['arm64', 'x64'].includes(arch))
  throw new Error(`Unsupported architecture: ${arch}`);

function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('bash', ['desktop/native/scripts/build-helper.sh'], {
  JAM_DESKTOP_ARCH: arch === 'x64' ? 'x86_64' : 'arm64',
});
run('npm', ['run', 'desktop:renderer']);
if (args.includes('--package')) {
  run(path.join(root, 'node_modules/.bin/electron-builder'), [
    '--config',
    'desktop/electron-builder.json',
    '--mac',
    `--${arch}`,
    '--publish',
    'never',
    ...(args.includes('--dir') ? ['--dir'] : []),
  ]);
}
