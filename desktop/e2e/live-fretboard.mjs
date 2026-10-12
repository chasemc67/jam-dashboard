// End-to-end check of the Live Fretboard tab: launches the app (dev or packaged)
// with a DevTools port, feeds a video file through the real file input, waits for
// tracking and saves screenshots of the overlay.
//
//   node desktop/e2e/live-fretboard.mjs --video clip.mp4 --out shots/ \
//     [--app "release/mac-arm64/Jam Dashboard.app"] [--shots 10] [--lefty] \
//     [--models v3,v1] [--fullscreen-shots 1]
// --lefty turns on the page-level Left-handed setting (model input flipped).
// --models picks each tracking model in turn from the picker while the video keeps
// running (runtime switch, no restart); shots are prefixed with the model id.
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
const lefty = args.includes('--lefty');
const fullscreenShots = Number(option('--fullscreen-shots', '1'));
const port = Number(option('--port', '9339'));
const interval = Number(option('--interval-ms', '700'));
const models = option('--models', '').split(',').filter(Boolean);
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

async function pressKey(key, code = key, keyCode = 13) {
  for (const type of ['keyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', {
      type,
      key,
      code,
      windowsVirtualKeyCode: keyCode,
    });
}

// Radix Select ignores synthetic option clicks; pick the option by keyboard.
async function chooseModel(id) {
  if (!(await evaluate(`!!document.querySelector('[role=option]')`)))
    await click(`document.querySelector('[data-testid=live-fretboard-model]')`);
  await waitFor(
    `!!document.querySelector('[role=option]')`,
    5000,
    'the model list',
  );
  await evaluate(
    `[...document.querySelectorAll('[role=option]')].find(o => o.textContent.includes(' ${id} ')).focus()`,
  );
  await pressKey('Enter');
  await waitFor(
    `!document.querySelector('[role=option]')`,
    5000,
    'the model list to close',
  );
}

const summary = { video, lefty, shots: [], stats: [] };
try {
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Page.enable');
  await waitFor(
    `document.readyState === 'complete' && !!document.querySelector('[role=tab]')`,
    30000,
    'the dashboard',
  );
  // The page-level Left-handed setting drives the model flip; set it, then reload.
  const settingsChanged = await evaluate(`(() => {
    const key = 'jam-dashboard-settings';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    if (stored.isLefty === ${lefty}) return false;
    localStorage.setItem(key, JSON.stringify({ ...stored, isLefty: ${lefty} }));
    return true;
  })()`);
  if (settingsChanged) {
    await evaluate('location.reload()').catch(() => {});
    await sleep(1000);
    await waitFor(
      `document.readyState === 'complete' && !!document.querySelector('[role=tab]')`,
      30000,
      'the dashboard after reload',
    );
  }
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
  if (models.length) await chooseModel(models[0]);
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
  const prefix = models.length ? `${models[0]}-` : '';
  for (let i = 0; i < shots; i++) {
    await capture(`${prefix}live-fretboard-${String(i + 1).padStart(2, '0')}`);
    await sleep(interval);
  }
  for (const id of models.slice(1)) {
    await chooseModel(id);
    await waitFor(
      `document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.model === '${id}'`,
      60000,
      `results from ${id}`,
    );
    await sleep(2500);
    for (let i = 0; i < shots; i++) {
      await capture(`${id}-live-fretboard-${String(i + 1).padStart(2, '0')}`);
      await sleep(interval);
    }
  }
  if (fullscreenShots > 0) {
    await click(
      `document.querySelector('[data-testid=live-fretboard-fullscreen]')`,
    );
    await waitFor(
      `document.fullscreenElement?.dataset.testid === 'live-fretboard-view'`,
      5000,
      'full screen',
    );
    await sleep(1500);
    for (let i = 0; i < fullscreenShots; i++) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(
        out,
        `fullscreen-${String(i + 1).padStart(2, '0')}.png`,
      );
      writeFileSync(file, Buffer.from(data, 'base64'));
      summary.shots.push({ file, fullscreen: true });
      await sleep(interval);
    }
    await pressKey('Escape', 'Escape', 27);
    summary.fullscreenExitedWithEsc = await waitFor(
      `!document.fullscreenElement`,
      3000,
      'Esc',
    ).catch(() => false);
    if (!summary.fullscreenExitedWithEsc) {
      await click(
        `document.querySelector('[data-testid=live-fretboard-fullscreen]')`,
      );
      summary.fullscreenExitedWithButton = await waitFor(
        `!document.fullscreenElement`,
        3000,
        'leaving full screen',
      );
    }
    console.log(
      `fullscreen: Esc exit ${summary.fullscreenExitedWithEsc}, button exit ${summary.fullscreenExitedWithButton ?? 'n/a'}`,
    );
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
