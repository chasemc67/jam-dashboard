// End-to-end check of the Live Fretboard tab: launches the app (dev or packaged)
// with a DevTools port, feeds a video file through the real file input, waits for
// tracking and saves screenshots of the overlay.
//
//   node desktop/e2e/live-fretboard.mjs --video clip.mp4 --out shots/ \
//     [--app "release/mac-arm64/Jam Dashboard.app"] [--shots 10] [--mirror-shots 2]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const require = createRequire(import.meta.url);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const video = path.resolve(option('--video', ''));
const out = path.resolve(option('--out', 'e2e-out'));
const appBundle = option('--app');
const shots = Number(option('--shots', '10'));
const mirrorShots = Number(option('--mirror-shots', '2'));
const port = Number(option('--port', '9339'));
const interval = Number(option('--interval-ms', '700'));
if (!option('--video')) throw new Error('--video is required');
mkdirSync(out, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const command = appBundle
  ? path.join(appBundle, 'Contents/MacOS/Jam Dashboard')
  : require('electron');
const child = spawn(
  command,
  [
    ...(appBundle ? [] : [path.join(root, 'desktop')]),
    `--remote-debugging-port=${port}`,
  ],
  { stdio: ['ignore', 'inherit', 'inherit'] },
);
const cleanup = () => child.kill();
process.on('exit', cleanup);

async function page() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
      ).json();
      const target = list.find(
        t => t.type === 'page' && t.url.startsWith('jam://dashboard'),
      );
      if (target) return target.webSocketDebuggerUrl;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error('The app window did not open.');
}

const socket = new WebSocket(await page(), { perMessageDeflate: false });
await new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});
let nextId = 1;
const waiting = new Map();
socket.on('message', data => {
  const message = JSON.parse(data.toString());
  const entry = waiting.get(message.id);
  if (!entry) return;
  waiting.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async expression => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
async function waitFor(expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(expression);
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function click(selectorExpression) {
  const rect = await evaluate(`(() => {
    const el = ${selectorExpression};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`Nothing to click: ${selectorExpression}`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
}

const summary = { video, shots: [], stats: [] };
try {
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Page.enable');
  await waitFor(
    `document.readyState === 'complete' && !!document.querySelector('[role=tab]')`,
    30000,
    'the dashboard',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click(
    `[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.includes('Live Fretboard'))`,
  );
  await waitFor(
    `!!document.querySelector('[data-testid=live-fretboard-file]')`,
    10000,
    'the Live Fretboard tab',
  );
  // Start unmirrored regardless of the persisted setting.
  await evaluate(
    `localStorage.setItem('jam-live-fretboard-mirrored', 'false')`,
  );
  if (
    await evaluate(
      `document.querySelector('#live-fretboard-mirror')?.getAttribute('data-state') === 'checked'`,
    )
  )
    await click(`document.querySelector('#live-fretboard-mirror')`);
  const { root: doc } = await send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await send('DOM.querySelector', {
    nodeId: doc.nodeId,
    selector: '[data-testid=live-fretboard-file]',
  });
  await send('DOM.setFileInputFiles', { nodeId, files: [video] });
  await waitFor(
    `Number(document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.frames ?? 0) > 30`,
    60000,
    'tracked frames',
  );

  const capture = async name => {
    const clip = await evaluate(`(() => {
      const canvas = document.querySelector('[data-testid=live-fretboard-canvas]');
      canvas.scrollIntoView({ block: 'start' });
      const r = canvas.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
    })()`);
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
    });
    const file = path.join(out, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    const stats = await evaluate(`(() => {
      const el = document.querySelector('[data-testid=live-fretboard-stats]');
      return el ? { text: el.textContent, ...el.dataset } : null;
    })()`);
    summary.shots.push({ file, stats });
    console.log(`${name}: ${stats?.text}`);
  };
  for (let i = 0; i < shots; i++) {
    await capture(`live-fretboard-${String(i + 1).padStart(2, '0')}`);
    await sleep(interval);
  }
  if (mirrorShots > 0) {
    await click(`document.querySelector('#live-fretboard-mirror')`);
    await sleep(2500);
    for (let i = 0; i < mirrorShots; i++) {
      await capture(
        `live-fretboard-mirrored-${String(i + 1).padStart(2, '0')}`,
      );
      await sleep(interval);
    }
    await click(`document.querySelector('#live-fretboard-mirror')`);
  }
  summary.error = await evaluate(
    `document.querySelector('[data-testid=live-fretboard] [role=alert]')?.textContent ?? null`,
  );
} finally {
  writeFileSync(
    path.join(out, 'summary.json'),
    JSON.stringify(summary, null, 2),
  );
  socket.close();
  cleanup();
}
if (summary.error) {
  console.error(`App error: ${summary.error}`);
  process.exit(1);
}
