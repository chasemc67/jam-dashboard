import { build } from 'esbuild';

// The packaged app excludes node_modules, so electron-updater ships as one bundle.
await build({
  entryPoints: ['electron-updater'],
  outfile: 'desktop/electron-updater.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'info',
});
