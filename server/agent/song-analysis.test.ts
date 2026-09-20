import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { startAgentService } from './service';
import {
  SongAnalysisSnapshotSchema,
  type SongAnalyzerHost,
} from '../../shared/agent/song-analysis';
import { ToolOutputSchema } from '../../shared/agent/tools';

const { AnalyzerService } = createRequire(import.meta.url)(
  '../../desktop/analyzer.cjs',
) as {
  AnalyzerService: new (options: {
    helperPath: string;
    destination: string;
    detectTools: () => { ytDlp: boolean; ffmpeg: boolean };
    spawnProcess: (
      executable: string,
      args: string[],
      options: { shell: boolean },
    ) => FakeChild;
    killGroup: (pid: number) => void;
  }) => SongAnalyzerHost & {
    stop(): void;
    detectTools: () => { ytDlp: boolean; ffmpeg: boolean };
  };
};

const source = {
  title: 'Blue Skies',
  url: 'https://www.youtube.com/watch?v=BaW_jenozKc',
  channel: 'Ella Fitzgerald',
  duration: 180,
};
const analysis = {
  bpm: 120,
  musicalKey: 'F♯ / G♭ minor',
  tempoConfidence: 0.8,
  keyConfidence: 0.7,
  keyScale: 'F# minor',
  relativeMajorKey: 'A major',
  relativeMajorKeyScale: 'A major',
};

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  constructor(readonly pid: number) {
    super();
  }
  event(value: unknown) {
    this.stdout.write(JSON.stringify(value) + '\n');
  }
}

async function setup(t: TestContext, mode: 'legacy' | 'auto' = 'auto') {
  const directory = mkdtempSync(path.join(tmpdir(), 'jam-mcp-analysis-'));
  const children: FakeChild[] = [];
  const killed: number[] = [];
  const calls: { args: string[]; shell: boolean }[] = [];
  const analyzer = new AnalyzerService({
    helperPath: process.execPath,
    destination: directory,
    detectTools: () => ({ ytDlp: true, ffmpeg: true }),
    spawnProcess: (
      _executable: string,
      args: string[],
      options: { shell: boolean },
    ) => {
      calls.push({ args, shell: options.shell });
      const child = new FakeChild(9000 + children.length);
      children.push(child);
      return child;
    },
    killGroup: (pid: number) => {
      killed.push(pid);
    },
  });
  t.after(() => {
    analyzer.stop();
    children.forEach(child => child.emit('close', 0));
    rmSync(directory, { recursive: true, force: true });
  });
  const token = randomBytes(32).toString('hex');
  const service = await startAgentService({
    token,
    port: 0,
    songAnalyzer: analyzer,
  });
  t.after(() => service.close());
  const client = new Client(
    { name: 'jam-analysis-test', version: '1.0.0' },
    { versionNegotiation: { mode } },
  );
  t.after(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.url), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const snapshot = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await call(name, args);
    assert.equal(result.isError, false, JSON.stringify(result));
    const content = ToolOutputSchema.parse(result.structuredContent);
    assert.equal(content.ok, true);
    return SongAnalysisSnapshotSchema.parse(content.data);
  };
  const error = async (
    name: string,
    args: Record<string, unknown>,
    code: string,
  ) => {
    const result = await call(name, args);
    assert.equal(result.isError, true, JSON.stringify(result));
    const content = ToolOutputSchema.parse(result.structuredContent);
    assert.equal(content.ok, false);
    assert.equal(content.error?.code, code);
  };
  return {
    analyzer,
    directory,
    children,
    killed,
    calls,
    service,
    call,
    snapshot,
    error,
  };
}

for (const mode of ['legacy', 'auto'] as const) {
  test(`MCP ${mode} starts a real analyzer job and returns its matched video, key and BPM`, async t => {
    const { directory, children, calls, service, call, snapshot, error } =
      await setup(t, mode);
    // Analysis is owned by the desktop process, independently of a renderer session.
    assert.deepEqual(service.registry.listSessions(), []);
    const capabilities = await call('get_capabilities');
    assert.equal(
      (
        ToolOutputSchema.parse(capabilities.structuredContent).data as {
          songAnalysis: { available: boolean };
        }
      ).songAnalysis.available,
      true,
    );
    const idle = await snapshot('get_song_analysis');
    assert.equal(idle.status, 'idle');
    assert.equal(idle.jobId, null);

    const started = await snapshot('analyze_song', {
      query: '  Blue Skies Ella Fitzgerald  ',
    });
    assert.equal(started.status, 'searching');
    assert.equal(started.query, 'Blue Skies Ella Fitzgerald');
    assert.ok(started.jobId);
    assert.equal(started.analysis, null);
    assert.deepEqual(calls, [
      {
        args: ['--json', 'search-download', started.query, directory],
        shell: false,
      },
    ]);
    await error('analyze_song', { query: 'Another song' }, 'ANALYZER_BUSY');
    assert.equal(calls.length, 1);
    assert.deepEqual(
      await snapshot('get_song_analysis', { jobId: started.jobId }),
      started,
    );

    children[0].event({ event: 'source', source });
    children[0].event({ event: 'status', status: 'downloading' });
    const downloading = await snapshot('get_song_analysis', {
      jobId: started.jobId,
    });
    assert.equal(downloading.status, 'downloading');
    assert.deepEqual(downloading.source, source);
    children[0].event({
      event: 'file',
      path: path.join(directory, 'Blue Skies.mp3'),
    });
    children[0].event({ event: 'status', status: 'analyzing' });
    children[0].event({ event: 'result', analysis });
    children[0].emit('close', 0);
    const complete = await snapshot('get_song_analysis', {
      jobId: started.jobId,
    });
    assert.deepEqual(complete, {
      ...started,
      status: 'complete',
      source,
      analysis,
    });
    const wireResult = await call('get_song_analysis', {
      jobId: started.jobId,
    });
    assert.ok(!JSON.stringify(wireResult).includes(directory));
    assert.deepEqual(
      Object.keys(
        ToolOutputSchema.parse(wireResult.structuredContent).data as object,
      ).sort(),
      ['analysis', 'error', 'jobId', 'query', 'source', 'status'],
    );

    const direct = await snapshot('analyze_song', { query: source.url });
    assert.notEqual(direct.jobId, started.jobId);
    assert.equal(direct.status, 'downloading');
    assert.deepEqual(calls[1].args, [
      '--json',
      'download',
      source.url,
      directory,
    ]);
    assert.deepEqual(
      await snapshot('get_song_analysis', { jobId: started.jobId }),
      complete,
    );
    assert.deepEqual(
      await snapshot('cancel_song_analysis', { jobId: started.jobId }),
      complete,
    );
    assert.equal((await snapshot('get_song_analysis')).jobId, direct.jobId);
    assert.equal(
      (await snapshot('cancel_song_analysis', { jobId: direct.jobId })).status,
      'cancelled',
    );
  });
}

test('MCP validates inputs, reports analyzer errors, and targets cancellation by job ID', async t => {
  const { analyzer, children, killed, calls, call, snapshot, error } =
    await setup(t);
  for (const [name, args] of [
    ['analyze_song', {}],
    ['analyze_song', { query: '' }],
    ['analyze_song', { query: 'A song', destination: '/tmp' }],
    ['analyze_song', { query: 'A song', sessionId: 'desktop' }],
    ['get_song_analysis', { jobId: 'not-a-uuid' }],
    ['cancel_song_analysis', {}],
    ['cancel_song_analysis', { jobId: 'not-a-uuid' }],
  ] as const) {
    // The official SDK can reject malformed inputs before the tool handler,
    // so these failures need not have our structured error envelope.
    const rejected = await call(name, args);
    assert.equal(rejected.isError, true, JSON.stringify(rejected));
  }
  assert.equal(calls.length, 0);
  await error(
    'analyze_song',
    { query: 'file:///tmp/song.mp3' },
    'INVALID_INPUT',
  );
  await error('analyze_song', { query: 'a'.repeat(501) }, 'INVALID_INPUT');
  await error(
    'analyze_song',
    { query: 'https://www.youtube.com/playlist?list=PLexample' },
    'INVALID_INPUT',
  );
  assert.equal(calls.length, 0);
  analyzer.detectTools = () => ({ ytDlp: false, ffmpeg: true });
  await error('analyze_song', { query: 'A song' }, 'DEPENDENCY_MISSING');
  assert.equal(calls.length, 0);
  analyzer.detectTools = () => ({ ytDlp: true, ffmpeg: true });

  const started = await snapshot('analyze_song', { query: 'A song' });
  const missingId = randomUUID();
  await error('get_song_analysis', { jobId: missingId }, 'ANALYSIS_NOT_FOUND');
  await error(
    'cancel_song_analysis',
    { jobId: missingId },
    'ANALYSIS_NOT_FOUND',
  );
  assert.deepEqual(killed, []);
  assert.deepEqual(await snapshot('get_song_analysis'), started);
  const cancelled = await snapshot('cancel_song_analysis', {
    jobId: started.jobId,
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(killed, [9000]);

  const next = await snapshot('analyze_song', { query: 'Another song' });
  assert.deepEqual(
    await snapshot('cancel_song_analysis', { jobId: started.jobId }),
    cancelled,
  );
  assert.deepEqual(killed, [9000]);
  children[0].event({ event: 'result', analysis });
  children[0].emit('close', 0);
  assert.deepEqual(
    await snapshot('get_song_analysis', { jobId: next.jobId }),
    next,
  );
  children[1].event({ event: 'error', message: 'No videos found.' });
  children[1].emit('close', 1);
  const failed = await snapshot('get_song_analysis', { jobId: next.jobId });
  assert.deepEqual(failed, {
    ...next,
    status: 'error',
    error: 'No videos found.',
  });
  assert.deepEqual(
    await snapshot('cancel_song_analysis', { jobId: next.jobId }),
    failed,
  );
});
