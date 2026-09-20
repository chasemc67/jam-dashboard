const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const {
  AnalyzerService,
  validateAnalysis,
  validateYouTubeURL,
  parseYouTubeInput,
} = require('../analyzer.cjs');

const result = {
  bpm: 120,
  musicalKey: 'F♯ / G♭ minor',
  keyScale: 'F# minor',
  relativeMajorKey: 'A major',
  relativeMajorKeyScale: 'A major',
  tempoConfidence: 0.8,
  keyConfidence: 0.7,
};
function setup(t, options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'jam-test-'));
  const file = path.join(directory, 'Song with spaces.wav');
  writeFileSync(file, 'fixture');
  const children = [];
  const calls = [];
  const killed = [];
  const changes = [];
  const service = new AnalyzerService({
    helperPath: '/usr/bin/true',
    destination: directory,
    detectTools: () => ({ ytDlp: true, ffmpeg: true }),
    spawnProcess: (...args) => {
      calls.push(args);
      const child = new EventEmitter();
      child.pid = 9000 + children.length;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      children.push(child);
      return child;
    },
    killGroup: pid => killed.push(pid),
    onChange: state => changes.push(state),
    ...options,
  });
  t.after(() => {
    service.stop();
    children.forEach(child => child.emit('close', 0));
    rmSync(directory, { recursive: true, force: true });
  });
  return { service, directory, file, children, calls, killed, changes };
}
const emit = (child, event) => child.stdout.write(JSON.stringify(event) + '\n');

test('YouTube validation rejects shell/protocol tricks and lookalike hosts', () => {
  assert.equal(
    validateYouTubeURL(' https://music.youtube.com/watch?v=123 '),
    'https://music.youtube.com/watch?v=123',
  );
  for (const input of [
    'file:///tmp/song.mp3',
    'https://youtube.com.evil.test/v',
    'https://evil.test/?youtube.com',
    '--exec touch /tmp/a',
    'https://user@youtube.com/v',
    null,
  ]) {
    assert.throws(() => validateYouTubeURL(input));
  }
});
test('YouTube inputs distinguish song names from URLs without searching invalid URLs', () => {
  assert.deepEqual(parseYouTubeInput('  Blue Skies Ella Fitzgerald  '), {
    kind: 'query',
    value: 'Blue Skies Ella Fitzgerald',
  });
  assert.deepEqual(parseYouTubeInput('youtu.be/BaW_jenozKc'), {
    kind: 'url',
    value: 'https://youtu.be/BaW_jenozKc',
  });
  assert.equal(
    parseYouTubeInput('https://music.youtube.com/watch?v=123').kind,
    'url',
  );
  assert.equal(parseYouTubeInput('Song: Live at Home').kind, 'query');
  for (const input of [
    '',
    '   ',
    null,
    'song\0name',
    'song\nname',
    'a'.repeat(501),
    'file:///tmp/song.mp3',
    'javascript:alert(1)',
    'data:text/plain,song',
    'https://youtube.com.evil.test/watch?v=123',
    'https://user@youtube.com/v',
    'https://',
    'www.example.com/video',
    '//example.com/video',
  ])
    assert.throws(() => parseYouTubeInput(input));
});

const source = {
  title: 'A song',
  url: 'https://www.youtube.com/watch?v=BaW_jenozKc',
  channel: 'An artist',
  duration: 180,
};
test('song searches use one literal argument and retain the resolved source through analysis', t => {
  const { service, directory, children, calls } = setup(t);
  const query = '--exec "echo test" $(literal song name)';
  service.startYouTube(query);
  assert.equal(service.state.status, 'searching');
  assert.deepEqual(calls[0][1], [
    '--json',
    'search-download',
    query,
    directory,
  ]);
  assert.equal(calls[0][2].shell, false);
  emit(children[0], { event: 'source', source });
  emit(children[0], { event: 'status', status: 'downloading' });
  assert.deepEqual(service.snapshot().source, source);
  assert.equal(service.state.status, 'downloading');
  emit(children[0], { event: 'file', path: path.join(directory, 'Song.mp3') });
  emit(children[0], { event: 'status', status: 'analyzing' });
  emit(children[0], { event: 'result', analysis: result });
  children[0].emit('close', 0);
  assert.equal(service.state.status, 'complete');
  assert.deepEqual(service.snapshot().source, source);
  service.startYouTube('https://youtu.be/test');
  assert.deepEqual(calls[1][1], [
    '--json',
    'download',
    'https://youtu.be/test',
    directory,
  ]);
  assert.equal(service.state.status, 'downloading');
  assert.equal(service.state.source, null);
});
test('cancelling a search ignores late results and clears the source for a new job', t => {
  const { service, file, children, killed } = setup(t);
  service.startYouTube('A song');
  emit(children[0], { event: 'source', source });
  service.stop();
  assert.deepEqual(killed, [9000]);
  assert.equal(service.state.status, 'cancelled');
  service.startFile(file);
  emit(children[0], { event: 'source', source });
  emit(children[0], { event: 'status', status: 'downloading' });
  assert.equal(service.state.source, null);
  assert.equal(service.state.status, 'analyzing');
});
test('unsafe search metadata fails before it can be displayed', t => {
  const { service, children, killed } = setup(t);
  for (const update of [
    { url: 'javascript:alert(1)' },
    { url: 'https://evil.test/watch?v=BaW_jenozKc' },
    { title: '' },
    { title: 'A song\n' },
    { url: source.url + '\n' },
    { channel: ' ' },
    { channel: 42 },
    { duration: -1 },
  ]) {
    service.startYouTube('A song');
    emit(children.at(-1), {
      event: 'source',
      source: { ...source, ...update },
    });
    assert.equal(service.state.status, 'error');
    assert.equal(service.state.source, null);
  }
  assert.equal(killed.length, 8);
});
test('analysis contract rejects non-finite values and invalid selectable keys', () => {
  assert.deepEqual(validateAnalysis(result), result);
  for (const update of [
    { bpm: NaN },
    { keyConfidence: 2 },
    { keyScale: 'F♯ / G♭ minor' },
    { relativeMajorKeyScale: 'H major' },
  ]) {
    assert.throws(() => validateAnalysis({ ...result, ...update }));
  }
});
test('local file job uses fixed helper arguments and preserves a completed structured result', t => {
  const { service, file, children, calls } = setup(t);
  service.startFile(file);
  assert.equal(service.state.status, 'analyzing');
  assert.deepEqual(calls[0].slice(0, 2), [
    '/usr/bin/true',
    ['--json', 'analyze', file],
  ]);
  assert.equal(calls[0][2].shell, false);
  assert.equal(calls[0][2].detached, true);
  const wire = JSON.stringify({ event: 'result', analysis: result }) + '\n';
  children[0].stdout.write(wire.slice(0, 30));
  children[0].stdout.write(wire.slice(30));
  assert.equal(service.state.analysis, null);
  children[0].emit('close', 0);
  assert.equal(service.state.status, 'complete');
  assert.deepEqual(service.snapshot().analysis, result);
  const snapshot = service.snapshot();
  snapshot.analysis.bpm = 42;
  assert.equal(service.snapshot().analysis.bpm, 120);
});
test('download progress retains saved file when analysis fails', t => {
  const { service, directory, children } = setup(t);
  service.startYouTube('https://youtu.be/test');
  assert.equal(service.state.status, 'downloading');
  const file = path.join(directory, 'Song.mp3');
  emit(children[0], { event: 'file', path: file });
  emit(children[0], { event: 'status', status: 'analyzing' });
  emit(children[0], { event: 'error', message: 'Audio is too short.' });
  children[0].emit('close', 1);
  assert.equal(service.state.status, 'error');
  assert.equal(service.state.file.path, file);
  assert.equal(service.state.error, 'Audio is too short.');
});
test('only one job can run and cancellation rejects late output from the old process', t => {
  const { service, file, children, killed } = setup(t);
  service.startFile(file);
  assert.throws(() => service.startFile(file), /already running/);
  service.stop();
  assert.deepEqual(killed, [9000]);
  assert.equal(service.state.status, 'cancelled');
  service.startFile(file);
  emit(children[0], { event: 'result', analysis: result });
  children[0].emit('close', 0);
  assert.equal(service.state.status, 'analyzing');
  assert.equal(service.state.analysis, null);
  emit(children[1], { event: 'result', analysis: result });
  children[1].emit('close', 0);
  assert.equal(service.state.status, 'complete');
});
test('missing dependencies fail before spawning and refresh their status', t => {
  const { service, calls, file } = setup(t, {
    detectTools: () => ({ ffmpeg: true, ytDlp: false }),
  });
  assert.throws(() => service.startYouTube('https://youtu.be/test'), /Install/);
  assert.equal(calls.length, 0);
  service.startFile(file);
  assert.equal(calls.length, 1);
});
test('malformed worker output fails cleanly and terminates the process group', t => {
  const { service, file, children, killed } = setup(t);
  service.startFile(file);
  children[0].stdout.write('not json\n');
  assert.equal(service.state.status, 'error');
  assert.deepEqual(killed, [9000]);
});
test('deadline terminates the job', async t => {
  const { service, file, killed } = setup(t, { timeoutMs: 10 });
  service.startFile(file);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(service.state.status, 'error');
  assert.match(service.state.error, /timed out/);
  assert.deepEqual(killed, [9000]);
});
