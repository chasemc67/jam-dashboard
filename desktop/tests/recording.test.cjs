const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { RecordingService, registerRecordingIPC } = require('../recording.cjs');
const metadata = {
  folderName: '2026-10-12_12-34-56_v3',
  model: 'v3',
  settings: { model: 'v3', camera: { deviceId: 'camera-1' } },
  startedAt: '2026-10-12T12:34:56Z',
};
async function setup(t) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'jam-record-test-'),
  );
  const shown = [];
  const service = new RecordingService({
    directory,
    appVersion: '1.2.3',
    reveal: p => shown.push(p),
  });
  t.after(async () => {
    await service.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { service, directory, shown };
}
test('IPC streams ordered chunks, finalizes frames and edits notes without losing frames', async t => {
  const { service, directory, shown } = await setup(t);
  const handlers = {};
  registerRecordingIPC((name, handler, raw) => {
    assert.equal(raw, true);
    handlers[name] = handler;
  }, service);
  const call = (method, ...args) =>
    handlers[`jam:recording-${method}`](...args);
  const { id } = await call('start', metadata);
  await Promise.all([
    call('append', id, 'settingChanges', {
      t_ms: 1,
      key: 'camera.deviceId',
      from: 'camera-1',
      to: 'camera-2',
    }),
    call('append', id, 'raw', new Uint8Array([1, 2])),
    call('append', id, 'raw', new Uint8Array([3])),
    call('append', id, 'overlay', new Uint8Array([9])),
    call('append', id, 'frames', {
      t_ms: 2,
      frameIndex: 0,
      overlay: { wires: [[1, 2]] },
    }),
  ]);
  await call('stop', id, 'first note');
  const folder = path.join(directory, (await fs.readdir(directory))[0]);
  assert.deepEqual(
    await fs.readFile(path.join(folder, 'raw.webm')),
    Buffer.from([1, 2, 3]),
  );
  assert.deepEqual(
    await fs.readFile(path.join(folder, 'overlay.webm')),
    Buffer.from([9]),
  );
  await call('note', id, 'edited\n雪');
  const json = JSON.parse(
    await fs.readFile(path.join(folder, 'session.json'), 'utf8'),
  );
  assert.deepEqual(json.settings, metadata.settings);
  assert.deepEqual(json.settingChanges, [
    { t_ms: 1, key: 'camera.deviceId', from: 'camera-1', to: 'camera-2' },
  ]);
  assert.equal(json.appVersion, '1.2.3');
  assert.equal(json.note, 'edited\n雪');
  assert.equal(json.frames.length, 1);
  assert.equal(
    await fs.readFile(path.join(folder, 'note.txt'), 'utf8'),
    json.note,
  );
  call('show', id);
  assert.equal(shown[0], path.join(folder, 'session.json'));
  assert.throws(() => call('append', id, 'raw', new Uint8Array([1])), /closed/);
});
test('rejects paths, invalid data, unknown ids and overlapping sessions', async t => {
  const { service } = await setup(t);
  await assert.rejects(
    service.start({ folderName: '../../escape' }),
    /Invalid/,
  );
  const { id } = await service.start(metadata);
  await assert.rejects(service.start(metadata), /Already/);
  assert.throws(
    () => service.append(id, '../escape', new Uint8Array()),
    /invalid/,
  );
  assert.throws(() => service.append(id, 'raw', 'bad'), /Invalid/);
  assert.throws(() => service.append(id, 'frames', {}), /Invalid/);
  for (const data of [
    {},
    { t_ms: -1, key: 'model', from: 'v3', to: 'v1' },
    { t_ms: 1, key: 'model', from: 'v3' },
  ])
    assert.throws(() => service.append(id, 'settingChanges', data), /Invalid/);
  assert.throws(() => service.show('../escape'), /Unknown/);
  assert.throws(() => service.note(id, 'x'), /Stop/);
});
test('same-second sessions get unique directories and close finalizes an empty recording', async t => {
  const { service, directory } = await setup(t);
  const first = await service.start(metadata);
  await service.stop(first.id);
  await service.start(metadata);
  await service.close();
  const folders = await fs.readdir(directory);
  assert.equal(folders.length, 2);
  for (const folder of folders)
    assert.deepEqual(
      JSON.parse(
        await fs.readFile(path.join(directory, folder, 'session.json')),
      ).frames,
      [],
    );
});

test('concurrent starts cannot open overlapping sessions', async t => {
  const { service } = await setup(t);
  const results = await Promise.allSettled([
    service.start(metadata),
    service.start(metadata),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});

test('failed writes are reported and recorded in the sidecar', async t => {
  const { service, directory } = await setup(t);
  const { id } = await service.start(metadata);
  const session = service.get(id);
  session.handles.raw.writeFile = async () => {
    throw new Error('Disk full');
  };
  await assert.rejects(
    service.append(id, 'raw', new Uint8Array([1])),
    /Disk full/,
  );
  await assert.rejects(service.stop(id, 'failure note'), /Disk full/);
  const folder = path.join(directory, (await fs.readdir(directory))[0]);
  const json = JSON.parse(await fs.readFile(path.join(folder, 'session.json')));
  assert.equal(json.error, 'Disk full');
  assert.equal(json.note, 'failure note');
});
