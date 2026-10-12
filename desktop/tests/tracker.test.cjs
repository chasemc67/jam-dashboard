const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const {
  FretTrackerService,
  encodeFrame,
  validateResult,
  FRAME_BYTES,
  HEADER_BYTES,
} = require('../tracker.cjs');

const H = [1500, -40, 200, 30, 180, 400, 0.2, 0.05, 1];
const frame = (extra = {}) => ({
  t: 1.5,
  width: 1920,
  height: 1080,
  mirrored: true,
  pixels: new Uint8Array(FRAME_BYTES),
  ...extra,
});

function fakeHelper({ reply = true, ready = true } = {}) {
  const children = [];
  const spawnProcess = (command, args) => {
    const child = new EventEmitter();
    child.command = command;
    child.args = args;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.killed = [];
    child.kill = signal => {
      child.killed.push(signal);
      setImmediate(() => child.emit('close', null));
    };
    const received = [];
    let bytes = Buffer.alloc(0);
    child.stdin.on('data', chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      while (bytes.length >= HEADER_BYTES + FRAME_BYTES) {
        const header = bytes.subarray(0, HEADER_BYTES);
        const message = {
          magic: header.toString('ascii', 0, 4),
          id: header.readUInt32LE(4),
          t: header.readDoubleLE(8),
          width: header.readUInt32LE(16),
          height: header.readUInt32LE(20),
          flags: header.readUInt32LE(24),
          payload: header.readUInt32LE(28),
        };
        received.push(message);
        bytes = bytes.subarray(HEADER_BYTES + FRAME_BYTES);
        if (reply)
          child.stdout.write(
            JSON.stringify({
              type: 'frame',
              id: message.id,
              t: message.t,
              valid: true,
              held: false,
              nFrets: 22,
              tau: 0.3,
              H,
              wires: [
                [
                  [1, 2],
                  [3, 4],
                ],
              ],
              boardScore: 0.9,
              anchors: 40,
              rmsePx: null,
              timingsMs: { model: 4.2, post: 0.4, total: 5 },
            }) + '\n',
          );
      }
    });
    child.received = received;
    children.push(child);
    if (ready)
      setImmediate(() =>
        child.stdout.write(
          '{"type":"ready","computeUnits":"all","loadMs":12}\n',
        ),
      );
    return child;
  };
  return { children, spawnProcess };
}

const quiet = { warn() {} };

test('encodes the 32-byte FRT1 header', () => {
  const [header, payload] = encodeFrame({ ...frame(), id: 7, reset: true });
  assert.equal(header.length, HEADER_BYTES);
  assert.equal(header.toString('ascii', 0, 4), 'FRT1');
  assert.equal(header.readUInt32LE(4), 7);
  assert.equal(header.readDoubleLE(8), 1.5);
  assert.equal(header.readUInt32LE(16), 1920);
  assert.equal(header.readUInt32LE(20), 1080);
  assert.equal(header.readUInt32LE(24), 3);
  assert.equal(header.readUInt32LE(28), FRAME_BYTES);
  assert.equal(payload.length, FRAME_BYTES);
});

test('tracks a frame through the helper and returns a sanitized result', async t => {
  const helper = fakeHelper();
  const service = new FretTrackerService({
    helperPath: '/app/FretTrackerCLI',
    modelPath: '/app/FretTrackerV1.mlmodelc',
    spawnProcess: helper.spawnProcess,
    log: quiet,
  });
  t.after(() => service.stop());
  const result = await service.track(frame());
  assert.deepEqual(helper.children[0].args, [
    '--model',
    '/app/FretTrackerV1.mlmodelc',
  ]);
  assert.equal(helper.children[0].received[0].flags, 1);
  assert.equal(result.valid, true);
  assert.deepEqual(result.H, H);
  assert.equal(result.nFrets, 22);
  assert.equal(result.rmsePx, null);
  assert.equal(result.timingsMs.prep, null);
  assert.equal(service.info.computeUnits, 'all');
  // Reuses the running helper.
  await service.track(frame({ reset: true }));
  assert.equal(helper.children.length, 1);
  assert.equal(helper.children[0].received[1].flags, 3);
});

test('drops a frame while another is in flight', async t => {
  const helper = fakeHelper();
  const service = new FretTrackerService({
    helperPath: 'x',
    modelPath: 'y',
    spawnProcess: helper.spawnProcess,
    log: quiet,
  });
  t.after(() => service.stop());
  const first = service.track(frame());
  await assert.rejects(service.track(frame()), { code: 'busy' });
  assert.equal((await first).valid, true);
});

test('rejects malformed frames before they reach the helper', async () => {
  const helper = fakeHelper();
  const service = new FretTrackerService({
    helperPath: 'x',
    modelPath: 'y',
    spawnProcess: helper.spawnProcess,
    log: quiet,
  });
  await assert.rejects(service.track(frame({ pixels: new Uint8Array(10) })), {
    code: 'invalid',
  });
  await assert.rejects(service.track(frame({ width: 0 })), { code: 'invalid' });
  await assert.rejects(service.track(frame({ t: NaN })), { code: 'invalid' });
  assert.equal(helper.children.length, 0);
});

test('times out a stuck helper and restarts it for the next frame', async t => {
  const helper = fakeHelper({ reply: false });
  const service = new FretTrackerService({
    helperPath: 'x',
    modelPath: 'y',
    spawnProcess: helper.spawnProcess,
    frameTimeoutMs: 20,
    log: quiet,
  });
  t.after(() => service.stop());
  await assert.rejects(service.track(frame()), { code: 'timeout' });
  assert.deepEqual(helper.children[0].killed, ['SIGKILL']);
  await assert.rejects(service.track(frame()), { code: 'timeout' });
  assert.equal(helper.children.length, 2);
});

test('reports a helper that fails to load the model', async () => {
  const helper = fakeHelper({ ready: false });
  const service = new FretTrackerService({
    helperPath: 'x',
    modelPath: 'y',
    spawnProcess: (...args) => {
      const child = helper.spawnProcess(...args);
      setImmediate(() =>
        child.stdout.write('{"type":"error","message":"no model"}\n'),
      );
      return child;
    },
    log: quiet,
  });
  await assert.rejects(service.track(frame()), /no model/);
  assert.equal(service.pending, undefined);
});

test('defaults to v1 and restarts the helper when the frame names another model', async t => {
  const helper = fakeHelper();
  const service = new FretTrackerService({
    helperPath: 'x',
    models: {
      v1: '/app/FretTrackerV1.mlmodelc',
      v3: '/app/FretTrackerV3.mlmodelc',
    },
    spawnProcess: helper.spawnProcess,
    log: quiet,
  });
  t.after(() => service.stop());
  assert.equal((await service.track(frame())).model, 'v1');
  assert.deepEqual(helper.children[0].args, [
    '--model',
    '/app/FretTrackerV1.mlmodelc',
  ]);
  assert.equal((await service.track(frame({ model: 'v1' }))).model, 'v1');
  assert.equal(helper.children.length, 1);
  const switched = await service.track(frame({ model: 'v3' }));
  assert.equal(switched.model, 'v3');
  assert.equal(service.info.model, 'v3');
  assert.deepEqual(helper.children[0].killed, ['SIGKILL']);
  assert.deepEqual(helper.children[1].args, [
    '--model',
    '/app/FretTrackerV3.mlmodelc',
  ]);
  // A frame without a model keeps the running one.
  assert.equal((await service.track(frame())).model, 'v3');
  assert.equal(helper.children.length, 2);
});

test('rejects unknown or missing models', async () => {
  const helper = fakeHelper();
  const service = new FretTrackerService({
    helperPath: 'x',
    modelPath: '/app/FretTrackerV1.mlmodelc',
    spawnProcess: helper.spawnProcess,
    log: quiet,
  });
  await assert.rejects(service.track(frame({ model: 'v9' })), {
    code: 'invalid',
  });
  await assert.rejects(service.track(frame({ model: 'v3' })), /not installed/);
  assert.equal(helper.children.length, 0);
});

test('result validation drops non-finite values and bad wires', () => {
  const result = validateResult({
    type: 'frame',
    id: 1,
    valid: true,
    nFrets: 40,
    H: [1, 0, 0, 0, 1, 0, 0, 0, null],
    wires: [[[1, 2]], 'x'],
  });
  assert.equal(result.valid, false);
  assert.equal(result.H, null);
  assert.equal(result.nFrets, 24);
  assert.deepEqual(result.wires, []);
  assert.throws(() => validateResult({ type: 'ready' }));
});
