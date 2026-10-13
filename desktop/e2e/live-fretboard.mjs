// End-to-end check of the Live Fretboard tab: launches the app (dev or packaged)
// with a DevTools port, feeds a video file through the real file input, waits for
// tracking and saves screenshots of the overlay.
//
//   node desktop/e2e/live-fretboard.mjs --video clip.mp4 --out shots/ \
//     [--app "release/mac-arm64/Jam Dashboard.app"] [--shots 10] [--lefty] \
//     [--models v3,v1] [--fullscreen-shots 1] [--hand-cutout vision-fast] [--hand-opacity 100] [--capture-seconds 10]
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
// Capture the rendered canvas through the browser without using the product Record feature.
const captureSeconds = Number(option('--capture-seconds', '0'));
if (
  !Number.isFinite(captureSeconds) ||
  captureSeconds < 0 ||
  captureSeconds > 120
)
  throw new Error('Invalid --capture-seconds (expected 0–120)');
const lefty = args.includes('--lefty');
const handCutout = option('--hand-cutout', 'off');
const handOpacity = Number(option('--hand-opacity', '100'));
if (!Number.isFinite(handOpacity) || handOpacity < 0 || handOpacity > 100)
  throw new Error('Invalid --hand-opacity (expected 0–100)');
const seek = Number(option('--seek-seconds', '0'));
if (!Number.isFinite(seek) || seek < 0)
  throw new Error('Invalid --seek-seconds');
if (!['off', 'vision-fast', 'vision-balanced', 'skin'].includes(handCutout))
  throw new Error('Invalid --hand-cutout');
const fullscreenShots = Number(option('--fullscreen-shots', '1'));
const port = Number(option('--port', '9339'));
const interval = Number(option('--interval-ms', '700'));
const models = option('--models', '').split(',').filter(Boolean);
const bundledModels = ['v1', 'v3', 'v4q832', 'r832_w8a8', 'extended_512_w8a8'];
if (models.some(id => !bundledModels.includes(id)))
  throw new Error('Unknown --models id');
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

// Radix Select ignores synthetic option clicks; pick the option by keyboard and
// check the trigger (Radix focuses the selected item right after opening).
async function chooseModel(id) {
  const selected = `document.querySelector('[data-testid=live-fretboard-model]').dataset.modelId === ${JSON.stringify(id)}`;
  for (let attempt = 0; attempt < 4 && !(await evaluate(selected)); attempt++) {
    if (!(await evaluate(`!!document.querySelector('[role=option]')`)))
      await click(
        `document.querySelector('[data-testid=live-fretboard-model]')`,
      );
    await waitFor(
      `!!document.querySelector('[role=option]')`,
      5000,
      'the model list',
    );
    await sleep(400);
    await evaluate(
      `[...document.querySelectorAll('[role=option]')].find(o => o.dataset.modelId === ${JSON.stringify(id)}).focus()`,
    );
    await pressKey('Enter');
    await sleep(400);
  }
  if (!(await evaluate(selected))) throw new Error(`Could not select ${id}`);
}

const summary = { video, lefty, handCutout, handOpacity, shots: [], stats: [] };
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
    const opacityChanged = localStorage.getItem('jam-live-fretboard-hand-opacity') !== ${JSON.stringify(String(handOpacity))};
    localStorage.setItem('jam-live-fretboard-hand-opacity', ${JSON.stringify(String(handOpacity))});
    const handChanged = localStorage.getItem('jam-live-fretboard-hand-cutout') !== ${JSON.stringify(String(handCutout !== 'off'))} || localStorage.getItem('jam-live-fretboard-hand-option') !== ${JSON.stringify(handCutout)};
    localStorage.setItem('jam-live-fretboard-hand-cutout', ${JSON.stringify(String(handCutout !== 'off'))});
    localStorage.setItem('jam-live-fretboard-hand-option', ${JSON.stringify(handCutout)});
    const key = 'jam-dashboard-settings';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    // The persisted model loads after mount, so start from the first one.
    const model = ${JSON.stringify(models[0] ?? null)};
    const modelKey = 'jam-live-fretboard-model';
    const modelChanged = !!model && localStorage.getItem(modelKey) !== model;
    if (model) localStorage.setItem(modelKey, model);
    if (stored.isLefty === ${lefty} && !modelChanged && !handChanged && !opacityChanged) return false;
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

  if (seek) {
    await evaluate(
      `document.querySelector('[data-testid=live-fretboard] video').currentTime = ${seek}`,
    );
    await sleep(1500);
  }
  if (handCutout !== 'off')
    await waitFor(
      `document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handCutout === ${JSON.stringify(handCutout)} && document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handMask === 'true'`,
      30000,
      'a native hand mask',
    );
  if (handCutout !== 'off') {
    summary.handToggleInitiallyChecked = await evaluate(
      `document.querySelector('[data-testid=live-fretboard-hand-cutout]').checked`,
    );
    if (!summary.handToggleInitiallyChecked)
      throw new Error('Hand setting did not restore');
    await click(
      `document.querySelector('[data-testid=live-fretboard-hand-cutout]')`,
    );
    await waitFor(
      `document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handCutout === 'off' && document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handMs === '0' && document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handMask === 'false'`,
      10000,
      'off with zero mask work',
    );
    summary.handOffVerified = true;
    await click(
      `document.querySelector('[data-testid=live-fretboard-hand-cutout]')`,
    );
    await waitFor(
      `document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handCutout === ${JSON.stringify(handCutout)} && document.querySelector('[data-testid=live-fretboard-stats]')?.dataset.handMask === 'true'`,
      10000,
      'hand cutout restored',
    );
    summary.handPersistenceVerified = await evaluate(
      `localStorage.getItem('jam-live-fretboard-hand-cutout') === 'true' && localStorage.getItem('jam-live-fretboard-hand-option') === ${JSON.stringify(handCutout)}`,
    );
    if (!summary.handPersistenceVerified)
      throw new Error('Hand setting did not persist');
  }
  summary.handOpacityRestored = await evaluate(
    `Number(document.querySelector('[data-testid=live-fretboard-hand-opacity]').value) === ${handOpacity}`,
  );
  if (!summary.handOpacityRestored)
    throw new Error('Hand opacity did not restore');
  // Exercise React's actual range handler, then return to the requested screenshot value.
  for (const value of [handOpacity === 0 ? 100 : 0, handOpacity]) {
    await evaluate(`(() => {
      const slider = document.querySelector('[data-testid=live-fretboard-hand-opacity]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, ${value});
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(
      `localStorage.getItem('jam-live-fretboard-hand-opacity') === '${value}' && document.querySelector('[data-testid=live-fretboard-stats]').dataset.handOpacity === '${value}'`,
      5000,
      'opacity change and persistence',
    );
  }
  summary.handOpacityPersistenceVerified = true;
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
  const captureVideo = async id => {
    if (!captureSeconds || summary.stats.some(stats => stats.model === id))
      return;
    const recording = await evaluate(`(async () => {
      const canvas = document.querySelector('[data-testid=live-fretboard-canvas]');
      const video = document.querySelector('[data-testid=live-fretboard] video');
      // Every model gets the same source interval, with a settled model before seeking.
      video.pause();
      if (Math.abs(video.currentTime - ${seek}) > 0.01) {
        await new Promise(resolve => {
          video.addEventListener('seeked', resolve, { once: true });
          video.currentTime = ${seek};
        });
      }
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 6000000 });
      const chunks = [], samples = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      const start = performance.now();
      const sample = () => {
        const el = document.querySelector('[data-testid=live-fretboard-stats]');
        if (el) samples.push({ elapsedMs: performance.now() - start, mediaTime: video.currentTime, ...el.dataset });
      };
      sample();
      const timer = setInterval(sample, 100);
      recorder.start();
      await video.play();
      await new Promise(resolve => setTimeout(resolve, ${captureSeconds * 1000}));
      sample(); clearInterval(timer); recorder.stop(); await stopped;
      stream.getTracks().forEach(track => track.stop());
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { base64: btoa(binary), samples };
    })()`);
    const file = path.join(out, `${id}.webm`);
    writeFileSync(file, Buffer.from(recording.base64, 'base64'));
    const samples = recording.samples;
    if (samples.some(sample => sample.model !== id))
      throw new Error(`Wrong model during ${id} capture`);
    if (!samples.some(sample => sample.valid === 'true'))
      throw new Error(`No valid tracking for ${id}`);
    const first = samples[0],
      last = samples.at(-1);
    const fps =
      ((Number(last.frames) - Number(first.frames)) * 1000) /
      (last.elapsedMs - first.elapsedMs);
    if (!(fps > 0)) throw new Error(`No tracking progress for ${id}`);
    const unique = [
      ...new Map(samples.map(sample => [sample.frames, sample])).values(),
    ];
    const timings = unique
      .map(sample => Number(sample.modelMs))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const stats = {
      model: id,
      file,
      fps,
      modelMsMedian: timings[Math.floor(timings.length / 2)],
      modelMsP95: timings[Math.floor((timings.length - 1) * 0.95)],
      samples,
    };
    summary.stats.push(stats);
    console.log(
      `${id}: ${fps.toFixed(2)} tracked fps, model median ${stats.modelMsMedian.toFixed(2)} ms`,
    );
  };
  await captureVideo(
    models[0] ??
      (await evaluate(
        `document.querySelector('[data-testid=live-fretboard-stats]').dataset.model`,
      )),
  );
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
    await captureVideo(id);
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
