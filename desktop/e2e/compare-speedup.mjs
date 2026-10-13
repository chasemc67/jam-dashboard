// node desktop/e2e/compare-speedup.mjs out/speedup/0906
// Run after live-fretboard.mjs --capture-seconds; requires ffmpeg with drawtext.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const directory = path.resolve(process.argv[2]);
const summary = JSON.parse(
  readFileSync(path.join(directory, 'summary.json'), 'utf8'),
);
const models = [
  ['v1', 'v1'],
  ['r832_w8a8', 'v4q-832 fast (8-bit)'],
  ['extended_512_w8a8', 'ResNet-34 512 fast (8-bit)'],
];
const inputs = [],
  filters = [];
for (const [i, [id, label]] of models.entries()) {
  const stats = summary.stats.findLast(row => row.model === id);
  if (!stats || !(stats.fps > 0))
    throw new Error(`Missing measured capture for ${id}`);
  inputs.push('-i', path.join(directory, `${id}.webm`));
  const timing = `${stats.fps.toFixed(1)} fps | model ${stats.modelMsMedian.toFixed(1)} ms`;
  filters.push(
    `[${i}:v]setpts=PTS-STARTPTS,fps=30,scale=640:360:force_original_aspect_ratio=decrease,pad=640:420:(ow-iw)/2:60+(360-ih)/2:color=black,drawtext=text='${label}':fontcolor=white:fontsize=22:x=(w-tw)/2:y=6,drawtext=text='${timing}':fontcolor=white:fontsize=18:x=(w-tw)/2:y=33[v${i}]`,
  );
}
filters.push('[v0][v1][v2]hstack=inputs=3:shortest=1[out]');
const result = spawnSync(
  'ffmpeg',
  [
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    path.join(directory, 'comparison.mp4'),
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
