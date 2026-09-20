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

test('MCP starts a search immediately and reports its source and analysis without local paths', t => {
  const { service, directory, children } = setup(t);
  assert.deepEqual(service.getSongAnalysis(), {
    jobId: null,
    status: 'idle',
    query: null,
    source: null,
    analysis: null,
    error: null,
  });
  const started = service.startSongAnalysis('  Blue Skies Ella Fitzgerald  ');
  assert.match(started.jobId, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/);
  assert.deepEqual(started, {
    jobId: service.snapshot().jobId,
    status: 'searching',
    query: 'Blue Skies Ella Fitzgerald',
    source: null,
    analysis: null,
    error: null,
  });
  emit(children[0], { event: 'source', source });
  emit(children[0], { event: 'status', status: 'downloading' });
  assert.equal(service.getSongAnalysis(started.jobId).status, 'downloading');
  emit(children[0], { event: 'file', path: path.join(directory, 'Song.mp3') });
  emit(children[0], { event: 'status', status: 'analyzing' });
  assert.equal(service.getSongAnalysis(started.jobId).status, 'analyzing');
  emit(children[0], { event: 'result', analysis: result });
  children[0].emit('close', 0);
  const completed = service.getSongAnalysis(started.jobId);
  assert.deepEqual(completed, {
    ...started,
    status: 'complete',
    source,
    analysis: result,
  });
  assert.ok(!JSON.stringify(completed).includes(directory));
  completed.analysis.bpm = 42;
  completed.source.title = 'Changed';
  assert.equal(service.getSongAnalysis(started.jobId).analysis.bpm, 120);
  assert.equal(service.getSongAnalysis(started.jobId).source.title, 'A song');
});

test('MCP preserves direct URLs and cannot replace an active manual job', t => {
  const { service, file, children, calls } = setup(t);
  service.startFile(file);
  const manualJob = service.getSongAnalysis();
  assert.equal(manualJob.query, null);
  assert.ok(manualJob.jobId);
  assert.throws(() => service.startSongAnalysis('A song'), {
    code: 'ANALYZER_BUSY',
  });
  assert.equal(service.getSongAnalysis().jobId, manualJob.jobId);
  assert.equal(calls.length, 1);
  emit(children[0], { event: 'result', analysis: result });
  children[0].emit('close', 0);
  const direct = service.startSongAnalysis('https://youtu.be/BaW_jenozKc');
  assert.notEqual(direct.jobId, manualJob.jobId);
  assert.equal(direct.status, 'downloading');
  assert.equal(direct.query, 'https://www.youtube.com/watch?v=BaW_jenozKc');
  assert.equal(calls[1][1][1], 'download');
  assert.deepEqual(service.getSongAnalysis(manualJob.jobId).analysis, result);
});

test('MCP direct URLs select one video and discard playlist parameters', t => {
  const { service, calls } = setup(t);
  const canonical = 'https://www.youtube.com/watch?v=BaW_jenozKc';
  for (const url of [
    'https://www.youtube.com/watch?v=BaW_jenozKc&list=PL123&index=2',
    'http://music.youtube.com/watch?v=BaW_jenozKc',
    'https://youtu.be/BaW_jenozKc?list=PL123',
    'https://www.youtube.com/shorts/BaW_jenozKc?feature=share',
    'https://www.youtube.com/live/BaW_jenozKc',
    'https://www.youtube.com/embed/BaW_jenozKc/',
  ]) {
    const started = service.startSongAnalysis(url);
    assert.equal(started.status, 'downloading');
    assert.equal(started.query, canonical);
    assert.equal(calls.at(-1)[1][1], 'download');
    assert.equal(calls.at(-1)[1][2], canonical);
    service.stop();
  }
});

test('MCP rejects collection URLs before starting a download', t => {
  const { service, calls } = setup(t);
  for (const url of [
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/@artist',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/results?search_query=Blue+Skies',
    'https://www.youtube.com/watch?list=PL123',
    'https://www.youtube.com/watch?v=short',
    'https://youtu.be/BaW_jenozKc/other',
    'https://www.youtube.com/shorts/',
  ]) {
    assert.throws(() => service.startSongAnalysis(url), {
      code: 'INVALID_INPUT',
    });
    assert.equal(service.getSongAnalysis().status, 'idle');
    assert.equal(service.getSongAnalysis().jobId, null);
  }
  assert.deepEqual(calls, []);
  const search = service.startSongAnalysis('Blue Skies Ella Fitzgerald');
  assert.equal(search.status, 'searching');
  assert.equal(calls[0][1][1], 'search-download');
  assert.equal(calls[0][1][2], 'Blue Skies Ella Fitzgerald');
});

test('MCP cancellation targets only the exact job and remains safe after a new manual job', t => {
  const { service, file, children, killed } = setup(t);
  const first = service.startSongAnalysis('A song');
  emit(children[0], { event: 'source', source });
  const cancelled = service.cancelSongAnalysis(first.jobId);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(killed, [9000]);
  service.startFile(file);
  const manualId = service.getSongAnalysis().jobId;
  assert.notEqual(manualId, first.jobId);
  assert.deepEqual(service.cancelSongAnalysis(first.jobId), cancelled);
  assert.throws(() => service.cancelSongAnalysis('unknown-job'), {
    code: 'ANALYSIS_NOT_FOUND',
  });
  assert.equal(service.getSongAnalysis().status, 'analyzing');
  assert.equal(service.getSongAnalysis().jobId, manualId);
  assert.deepEqual(killed, [9000]);
  emit(children[0], { event: 'result', analysis: result });
  children[0].emit('close', 0);
  assert.deepEqual(service.getSongAnalysis(first.jobId), cancelled);
  assert.equal(service.getSongAnalysis().status, 'analyzing');
  assert.equal(service.cancelSongAnalysis(manualId).status, 'cancelled');
  assert.deepEqual(killed, [9000, 9001]);
});

test('MCP keeps eight terminal jobs, including completed manual analyses, without unbounded history', t => {
  const { service, file, children, killed } = setup(t);
  const ids = [];
  for (let index = 0; index < 9; index++) {
    service.startFile(file);
    ids.push(service.getSongAnalysis().jobId);
    emit(children[index], {
      event: 'result',
      analysis: { ...result, bpm: 100 + index },
    });
    children[index].emit('close', 0);
  }
  assert.equal(new Set(ids).size, 9);
  assert.equal(service.history.size, 8);
  assert.throws(() => service.getSongAnalysis(ids[0]), {
    code: 'ANALYSIS_NOT_FOUND',
  });
  assert.throws(() => service.getSongAnalysis('unknown'), {
    code: 'ANALYSIS_NOT_FOUND',
  });
  for (const [index, id] of ids.entries()) {
    if (!index) continue;
    const completed = service.getSongAnalysis(id);
    assert.equal(completed.analysis.bpm, 100 + index);
    assert.deepEqual(service.cancelSongAnalysis(id), completed);
    completed.analysis.bpm = 10;
    assert.equal(service.getSongAnalysis(id).analysis.bpm, 100 + index);
  }
  assert.deepEqual(killed, []);
});

test('MCP preflight errors have actionable codes and never start a job', t => {
  const { service, directory, calls } = setup(t);
  for (const input of ['', 'file:///tmp/song.mp3', 'A song\n']) {
    assert.throws(() => service.startSongAnalysis(input), {
      code: 'INVALID_INPUT',
    });
  }
  service.detectTools = () => ({ ytDlp: false, ffmpeg: true });
  assert.throws(() => service.startSongAnalysis('A song'), {
    code: 'DEPENDENCY_MISSING',
  });
  service.detectTools = () => ({ ytDlp: true, ffmpeg: true });
  service.helperPath = path.join(directory, 'missing-helper');
  assert.throws(() => service.startSongAnalysis('A song'), {
    code: 'DEPENDENCY_MISSING',
  });
  service.state.destination = path.join(directory, 'missing-folder');
  assert.throws(() => service.startSongAnalysis('A song'), {
    code: 'INVALID_INPUT',
  });
  assert.equal(service.getSongAnalysis().jobId, null);
  assert.deepEqual(calls, []);
});

test('MCP failure snapshots remain available when later work starts', t => {
  const { service, children } = setup(t);
  const failed = service.startSongAnalysis('A song');
  emit(children[0], { event: 'error', message: 'No videos found.' });
  children[0].emit('close', 1);
  service.startSongAnalysis('Another song');
  assert.deepEqual(service.getSongAnalysis(failed.jobId), {
    ...failed,
    status: 'error',
    error: 'No videos found.',
  });
  assert.equal(service.getSongAnalysis().query, 'Another song');
});
