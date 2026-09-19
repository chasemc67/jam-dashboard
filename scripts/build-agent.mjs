import { build } from 'esbuild';

await build({
  entryPoints: ['server/agent/desktop.ts'],
  outfile: 'desktop/agent-service.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'info',
});
