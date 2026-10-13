const { spawn } = require('node:child_process');

// FretTrackerCLI protocol (desktop/native/README.md): a 32-byte little-endian
// header, then a model-sized RGBA frame letterboxed from the (mirrored if needed)
// source. The helper answers each frame with one JSON line.
const INPUT_SIZE = 640;
const FRAME_BYTES = INPUT_SIZE * INPUT_SIZE * 4;
const HEADER_BYTES = 32;
const MAX_SOURCE_SIDE = 16384;
const FRAME_TIMEOUT_MS = 5000;
const READY_TIMEOUT_MS = 30000;
const MAX_STDOUT_LINE = 1 << 20;
// Bundled fretboard models (FretTrackerCLI loads either; both emit the same raw
// head layout). v1 = YOLO11s-pose (AGPL-3.0), v3/v4q832 = FretNet ResNet-50
// (permissive). See desktop/README.md.
const MODEL_IDS = ['v1', 'v3', 'v4q832'];
const inputSizeForModel = model => (model === 'v4q832' ? 832 : INPUT_SIZE);
const DEFAULT_MODEL = 'v1'; // see app/components/LiveFretboard/trackerModels.ts

function trackerError(code, message) {
  return Object.assign(new Error(message), { code });
}

function encodeFrame({ id, t, width, height, mirrored, reset, pixels }) {
  const header = Buffer.alloc(HEADER_BYTES);
  header.write('FRT1', 0, 'ascii');
  header.writeUInt32LE(id, 4);
  header.writeDoubleLE(t, 8);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(height, 20);
  header.writeUInt32LE((mirrored ? 1 : 0) | (reset ? 2 : 0), 24);
  header.writeUInt32LE(pixels.byteLength, 28);
  return [
    header,
    Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength),
  ];
}

function validateFrame(frame, currentModel = DEFAULT_MODEL) {
  if (!frame || typeof frame !== 'object')
    throw trackerError('invalid', 'Invalid frame.');
  const { t, width, height, mirrored, reset, pixels, model } = frame;
  const inputSize = inputSizeForModel(model ?? currentModel);
  if (!Number.isFinite(t)) throw trackerError('invalid', 'Invalid frame time.');
  for (const side of [width, height])
    if (!Number.isInteger(side) || side < 1 || side > MAX_SOURCE_SIDE)
      throw trackerError('invalid', 'Invalid frame size.');
  if (
    !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) ||
    pixels.byteLength !== inputSize * inputSize * 4
  )
    throw trackerError(
      'invalid',
      `Frames must be ${inputSize}x${inputSize} RGBA.`,
    );
  if (model !== undefined && !MODEL_IDS.includes(model))
    throw trackerError('invalid', 'Unknown tracker model.');
  return {
    t,
    width,
    height,
    mirrored: !!mirrored,
    reset: !!reset,
    pixels,
    model,
  };
}

const finiteOrNull = value => (Number.isFinite(value) ? value : null);
const isPoint = point =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every(value => Number.isFinite(value));

// Only pass on what the renderer draws, in a fixed shape.
function validateResult(value) {
  if (!value || value.type !== 'frame' || !Number.isInteger(value.id))
    throw trackerError('helper', 'The tracker returned an invalid frame.');
  const valid = value.valid === true;
  const H =
    valid && Array.isArray(value.H) && value.H.length === 9
      ? value.H.map(entry => (typeof entry === 'number' ? entry : NaN))
      : null;
  const nFrets = Number.isInteger(value.nFrets)
    ? Math.min(24, Math.max(1, value.nFrets))
    : 24;
  const wires =
    valid && Array.isArray(value.wires) && value.wires.length <= 25
      ? value.wires.filter(
          wire =>
            Array.isArray(wire) && wire.length === 2 && wire.every(isPoint),
        )
      : null;
  const timings =
    value.timingsMs && typeof value.timingsMs === 'object'
      ? Object.fromEntries(
          ['prep', 'model', 'post', 'total'].map(key => [
            key,
            finiteOrNull(value.timingsMs[key]),
          ]),
        )
      : {};
  return {
    id: value.id,
    t: finiteOrNull(value.t),
    valid: valid && !!H && H.every(Number.isFinite),
    held: value.held === true,
    nFrets,
    tau: finiteOrNull(value.tau) ?? 0.3,
    H: H && H.every(Number.isFinite) ? H : null,
    wires,
    boardScore: finiteOrNull(value.boardScore),
    anchors: Number.isInteger(value.anchors) ? value.anchors : 0,
    rmsePx: finiteOrNull(value.rmsePx),
    timingsMs: timings,
  };
}

class FretTrackerService {
  /**
   * `models` maps model ids (MODEL_IDS) to compiled .mlmodelc paths; a bare
   * `modelPath` is the single-model form. A frame naming another model than the
   * running one restarts the helper with that model (fresh smoothing and vote).
   */
  constructor({
    helperPath,
    modelPath,
    models = modelPath ? { v1: modelPath } : {},
    defaultModel = models[DEFAULT_MODEL]
      ? DEFAULT_MODEL
      : Object.keys(models)[0],
    spawnProcess = spawn,
    frameTimeoutMs = FRAME_TIMEOUT_MS,
    readyTimeoutMs = READY_TIMEOUT_MS,
    log = console,
  }) {
    this.helperPath = helperPath;
    this.models = models;
    this.model = defaultModel;
    this.spawnProcess = spawnProcess;
    this.frameTimeoutMs = frameTimeoutMs;
    this.readyTimeoutMs = readyTimeoutMs;
    this.log = log;
    this.child = undefined;
    this.ready = undefined;
    this.pending = undefined;
    this.nextId = 1;
    this.info = undefined;
  }

  start() {
    if (this.ready) return this.ready;
    const child = this.spawnProcess(
      this.helperPath,
      [
        '--model',
        this.models[this.model],
        ...(this.model === 'v4q832'
          ? ['--compute-units', 'cpuAndNeuralEngine']
          : []),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.child = child;
    let buffered = '';
    let settleReady;
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(trackerError('helper', 'The tracker did not start.')),
        this.readyTimeoutMs,
      );
      settleReady = (error, info) => {
        clearTimeout(timer);
        settleReady = undefined;
        if (error) reject(error);
        else resolve(info);
      };
    });
    // Avoid an unhandled rejection when nobody is waiting yet.
    ready.catch(() => {});
    this.ready = ready;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffered += chunk;
      if (buffered.length > MAX_STDOUT_LINE && !buffered.includes('\n')) {
        this.fail(child, trackerError('helper', 'Tracker output overflow.'));
        return;
      }
      let newline;
      while ((newline = buffered.indexOf('\n')) !== -1) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (line.trim()) this.handleLine(child, line, settleReady);
      }
    });
    child.stderr?.setEncoding?.('utf8');
    child.stderr?.on('data', text => this.log.warn('[tracker]', text.trim()));
    child.stdin.on('error', error =>
      this.fail(child, trackerError('helper', error.message)),
    );
    child.on('error', error =>
      this.fail(
        child,
        trackerError('helper', `The tracker could not start: ${error.message}`),
      ),
    );
    child.on('close', code =>
      this.fail(
        child,
        trackerError('helper', `The tracker stopped (exit ${code}).`),
      ),
    );
    this.settleReady = error => settleReady?.(error);
    return ready;
  }

  handleLine(child, line, settleReady) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      this.fail(child, trackerError('helper', 'The tracker sent bad output.'));
      return;
    }
    if (event.type === 'ready') {
      this.info = {
        model: this.model,
        computeUnits: String(event.computeUnits ?? ''),
        loadMs: finiteOrNull(event.loadMs),
      };
      settleReady?.(null, this.info);
    } else if (event.type === 'error') {
      this.fail(
        child,
        trackerError('helper', String(event.message ?? 'Tracker error.')),
      );
    } else if (event.type === 'frame') {
      const pending = this.pending;
      if (!pending || pending.id !== event.id) return;
      this.pending = undefined;
      clearTimeout(pending.timer);
      try {
        pending.resolve({ ...validateResult(event), model: this.model });
      } catch (error) {
        pending.reject(error);
      }
    }
  }

  fail(child, error) {
    if (child !== this.child) return;
    this.settleReady?.(error);
    this.child = undefined;
    this.ready = undefined;
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    try {
      child.kill('SIGKILL');
    } catch {
      // Already gone.
    }
  }

  /** Track one frame. Rejects with code "busy" while a frame is in flight. */
  async track(input) {
    const frame = validateFrame(input, this.model);
    if (this.pending) throw trackerError('busy', 'The tracker is busy.');
    const model = frame.model ?? this.model;
    if (!this.models[model])
      throw trackerError('invalid', `The ${model} model is not installed.`);
    if (model !== this.model) {
      this.stop();
      this.model = model;
    }
    const id = this.nextId++ >>> 0;
    const result = new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject, timer: undefined };
    });
    // Rejections are delivered through the returned promise.
    result.catch(() => {});
    try {
      await this.start();
    } catch (error) {
      this.pending = undefined;
      throw error;
    }
    const child = this.child;
    const pending = this.pending;
    if (!child || !pending || pending.id !== id)
      throw trackerError('helper', 'The tracker stopped.');
    pending.timer = setTimeout(
      () => this.fail(child, trackerError('timeout', 'The tracker timed out.')),
      this.frameTimeoutMs,
    );
    for (const chunk of encodeFrame({ ...frame, id })) child.stdin.write(chunk);
    return result;
  }

  stop() {
    if (this.child) {
      const child = this.child;
      this.fail(child, trackerError('stopped', 'The tracker was stopped.'));
    }
  }
}

module.exports = {
  FretTrackerService,
  MODEL_IDS,
  DEFAULT_MODEL,
  encodeFrame,
  validateFrame,
  validateResult,
  FRAME_BYTES,
  HEADER_BYTES,
  INPUT_SIZE,
};
