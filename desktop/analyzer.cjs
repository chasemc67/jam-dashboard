const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const {
  accessSync,
  constants,
  statSync,
  mkdtempSync,
  rmSync,
} = require('node:fs');
const { homedir, tmpdir } = require('node:os');
const path = require('node:path');

const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'aiff',
  'aif',
  'ogg',
  'opus',
  'mp4',
  'webm',
];
const keyPattern = /^[A-G](?:#|b)? (?:major|minor)$/;
const PUBLIC_HISTORY_LIMIT = 8;

function analyzerError(code, message) {
  return Object.assign(new Error(message), { code });
}

function validateAnalysis(value) {
  if (
    !value ||
    !Number.isFinite(value.bpm) ||
    value.bpm <= 0 ||
    value.bpm > 1000 ||
    typeof value.musicalKey !== 'string' ||
    value.musicalKey.length > 80 ||
    !['tempoConfidence', 'keyConfidence'].every(
      key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1,
    ) ||
    !['keyScale', 'relativeMajorKeyScale'].every(
      key =>
        value[key] === null ||
        (typeof value[key] === 'string' && keyPattern.test(value[key])),
    ) ||
    !(
      value.relativeMajorKey === null ||
      (typeof value.relativeMajorKey === 'string' &&
        value.relativeMajorKey.length < 80)
    )
  ) {
    throw new Error('The analyzer returned an invalid result.');
  }
  return Object.fromEntries(
    [
      'bpm',
      'musicalKey',
      'tempoConfidence',
      'keyConfidence',
      'keyScale',
      'relativeMajorKey',
      'relativeMajorKeyScale',
    ].map(key => [key, value[key]]),
  );
}

function validateYouTubeURL(raw) {
  if (typeof raw !== 'string' || raw.length > 4096)
    throw new Error('Enter a valid YouTube URL.');
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Enter a valid YouTube URL.');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !(
      url.hostname === 'youtu.be' ||
      url.hostname === 'youtube.com' ||
      url.hostname.endsWith('.youtube.com')
    )
  ) {
    throw new Error('Enter a valid youtube.com or youtu.be URL.');
  }
  return url.href;
}

function parseYouTubeInput(raw) {
  if (
    typeof raw !== 'string' ||
    raw.length > 4096 ||
    /\p{Cc}/u.test(raw) ||
    !raw.trim()
  )
    throw new Error('Enter a YouTube URL or song name.');
  const input = raw.trim();
  // A mistyped or unsupported URL must not become a song search.
  if (
    /^[a-z][a-z\d+.-]*:\/\//i.test(input) ||
    /^(?:https?|file|data|javascript|ftp|mailto):/i.test(input) ||
    /^(?:\/\/|www\.)/i.test(input) ||
    /^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(input)
  ) {
    const url = /^(?:[\w.-]+\.[a-z]{2,})(?:[/?#]|$)/i.test(input)
      ? `https://${input}`
      : input;
    return { kind: 'url', value: validateYouTubeURL(url) };
  }
  if (input.length > 500)
    throw new Error('Keep the song name and artist under 500 characters.');
  return { kind: 'query', value: input };
}

function validateYouTubeSource(source) {
  const validLabel = value =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 1024 &&
    !/\p{Cc}/u.test(value);
  if (
    !source ||
    !validLabel(source.title) ||
    typeof source.url !== 'string' ||
    /\p{Cc}/u.test(source.url) ||
    !/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(
      source.url,
    ) ||
    !(source.channel === null || validLabel(source.channel)) ||
    !(
      source.duration === null ||
      (Number.isFinite(source.duration) && source.duration >= 0)
    )
  )
    throw new Error('Invalid YouTube search result');
  return {
    title: source.title,
    url: source.url,
    channel: source.channel,
    duration: source.duration,
  };
}

function findTools() {
  const dirs = [
    path.join(homedir(), '.local/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const found = name =>
    dirs.some(dir => {
      try {
        accessSync(path.join(dir, name), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  return { ytDlp: found('yt-dlp'), ffmpeg: found('ffmpeg') };
}

/** Owns a single job and its snapshot independently of renderer/tab lifetime. */
class AnalyzerService {
  constructor({
    helperPath,
    destination,
    onChange = () => {},
    spawnProcess = spawn,
    killGroup = pid => process.kill(-pid, 'SIGKILL'),
    detectTools = findTools,
    timeoutMs = 30 * 60 * 1000,
  }) {
    Object.assign(this, {
      helperPath,
      onChange,
      spawnProcess,
      killGroup,
      detectTools,
      timeoutMs,
    });
    this.state = {
      revision: 0,
      jobId: null,
      query: null,
      status: 'idle',
      destination,
      tools: detectTools(),
      file: null,
      source: null,
      analysis: null,
      error: null,
    };
    this.job = null;
    this.history = new Map();
  }

  snapshot() {
    return structuredClone(this.state);
  }
  update(patch) {
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    if (
      this.state.jobId &&
      ['complete', 'error', 'cancelled'].includes(this.state.status)
    ) {
      this.history.set(this.state.jobId, this.publicSnapshot());
      while (this.history.size > PUBLIC_HISTORY_LIMIT)
        this.history.delete(this.history.keys().next().value);
    }
    this.onChange(this.snapshot());
  }
  publicSnapshot() {
    const { jobId, status, query, source, analysis, error } = this.state;
    return structuredClone({ jobId, status, query, source, analysis, error });
  }
  startSongAnalysis(query) {
    this.ensureIdle();
    let input;
    try {
      input = parseYouTubeInput(query);
    } catch (error) {
      throw analyzerError('INVALID_INPUT', error.message);
    }
    if (input.kind === 'url') {
      const url = new URL(input.value);
      const videoId =
        url.hostname === 'youtu.be'
          ? /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1]
          : url.pathname === '/watch'
            ? url.searchParams.get('v')
            : /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(
                url.pathname,
              )?.[1];
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId))
        throw analyzerError(
          'INVALID_INPUT',
          'Use a single YouTube video URL or a song name and artist. Channel, playlist, and search URLs are not supported for song analysis.',
        );
      // Removing playlist/channel parameters also bounds downloads to one video.
      input.value = `https://www.youtube.com/watch?v=${videoId}`;
    }
    this.startYouTube(input.value);
    return this.publicSnapshot();
  }
  getSongAnalysis(jobId) {
    if (
      jobId === undefined ||
      (typeof jobId === 'string' && jobId === this.state.jobId)
    )
      return this.publicSnapshot();
    const snapshot = this.history.get(jobId);
    if (!snapshot)
      throw analyzerError(
        'ANALYSIS_NOT_FOUND',
        'That analysis was not found. It may have expired or the app restarted.',
      );
    return structuredClone(snapshot);
  }
  cancelSongAnalysis(jobId) {
    // Resolve first, so an unknown or expired ID cannot affect the current job.
    const snapshot = this.getSongAnalysis(jobId);
    if (this.job?.id !== jobId) return snapshot;
    this.stop();
    return this.getSongAnalysis(jobId);
  }
  getState() {
    this.update({ tools: this.detectTools() });
    return this.snapshot();
  }
  ensureIdle() {
    if (this.job)
      throw analyzerError(
        'ANALYZER_BUSY',
        'An analysis is already running. Cancel it before starting another.',
      );
  }
  setDestination(destination) {
    this.ensureIdle();
    if (!statSync(destination).isDirectory())
      throw new Error('Choose an existing destination folder.');
    this.update({ destination });
  }
  startYouTube(raw) {
    this.ensureIdle();
    let input;
    try {
      input = parseYouTubeInput(raw);
    } catch (error) {
      throw analyzerError('INVALID_INPUT', error.message);
    }
    const tools = this.detectTools();
    this.update({ tools });
    if (!tools.ytDlp || !tools.ffmpeg)
      throw analyzerError(
        'DEPENDENCY_MISSING',
        'Install yt-dlp and ffmpeg with Homebrew, then try again.',
      );
    try {
      if (!statSync(this.state.destination).isDirectory()) throw new Error();
    } catch {
      throw analyzerError(
        'INVALID_INPUT',
        'The destination folder no longer exists.',
      );
    }
    const searching = input.kind === 'query';
    this.start(
      [
        searching ? 'search-download' : 'download',
        input.value,
        this.state.destination,
      ],
      null,
      searching ? 'searching' : 'downloading',
      input.value,
    );
  }
  startFile(filePath) {
    this.ensureIdle();
    try {
      if (
        typeof filePath !== 'string' ||
        !path.isAbsolute(filePath) ||
        filePath.includes('\0') ||
        !AUDIO_EXTENSIONS.includes(
          path.extname(filePath).slice(1).toLowerCase(),
        ) ||
        !statSync(filePath).isFile()
      )
        throw new Error();
    } catch {
      throw analyzerError('INVALID_INPUT', 'Choose a supported audio file.');
    }
    const tools = this.detectTools();
    this.update({ tools });
    if (!tools.ffmpeg)
      throw analyzerError(
        'DEPENDENCY_MISSING',
        'Install ffmpeg with Homebrew, then try again.',
      );
    this.start(
      ['analyze', filePath],
      { path: filePath, name: path.basename(filePath) },
      'analyzing',
    );
  }
  start(args, file, status, query = null) {
    try {
      accessSync(this.helperPath, constants.X_OK);
    } catch {
      throw analyzerError(
        'DEPENDENCY_MISSING',
        'The local analyzer is missing. Reinstall Jam Dashboard.',
      );
    }
    const temp = mkdtempSync(path.join(tmpdir(), 'jam-analyzer-'));
    const job = {
      id: randomUUID(),
      child: null,
      result: null,
      error: null,
      buffer: '',
      stderr: '',
      temp,
      timer: null,
    };
    this.job = job;
    this.update({
      jobId: job.id,
      query,
      status,
      file,
      source: null,
      analysis: null,
      error: null,
    });
    try {
      job.child = this.spawnProcess(this.helperPath, ['--json', ...args], {
        detached: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TMPDIR: temp + path.sep },
      });
      job.child.stdout.setEncoding('utf8');
      job.child.stderr.setEncoding('utf8');
      job.child.stdout.on('data', data => {
        if (this.job !== job) return;
        job.buffer += data;
        if (job.buffer.length > 1024 * 1024) {
          this.stop('error', 'The analyzer returned too much output.');
          return;
        }
        let index;
        while ((index = job.buffer.indexOf('\n')) >= 0) {
          const line = job.buffer.slice(0, index);
          job.buffer = job.buffer.slice(index + 1);
          if (!line.trim()) continue;
          try {
            this.handleEvent(job, JSON.parse(line));
          } catch {
            this.stop('error', 'The analyzer returned an invalid response.');
            return;
          }
        }
      });
      job.child.stderr.on('data', data => {
        job.stderr = (job.stderr + data).slice(-8192);
      });
      job.child.on('error', error => {
        if (this.job === job) this.finish(job, 'error', error.message);
      });
      job.child.on('close', code => {
        if (this.job === job) {
          if (code === 0 && job.result && !job.error)
            this.finish(job, 'complete');
          else
            this.finish(
              job,
              'error',
              job.error || job.stderr.trim() || 'Analysis could not finish.',
            );
        }
        rmSync(temp, { recursive: true, force: true });
      });
      job.timer = setTimeout(
        () =>
          this.job === job &&
          this.stop('error', 'Analysis timed out. Try a shorter recording.'),
        this.timeoutMs,
      );
      job.timer.unref?.();
    } catch (error) {
      this.finish(job, 'error', error.message);
      rmSync(temp, { recursive: true, force: true });
    }
  }
  handleEvent(job, event) {
    if (this.job !== job) return;
    switch (event.event) {
      case 'status':
        if (!['searching', 'downloading', 'analyzing'].includes(event.status))
          throw new Error('Invalid status');
        this.update({ status: event.status });
        break;
      case 'source':
        this.update({ source: validateYouTubeSource(event.source) });
        break;
      case 'file': {
        if (
          typeof event.path !== 'string' ||
          !path.isAbsolute(event.path) ||
          path.extname(event.path).toLowerCase() !== '.mp3'
        )
          throw new Error('Invalid file');
        const relative = path.relative(this.state.destination, event.path);
        if (
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        )
          throw new Error('Invalid destination');
        this.update({
          file: { path: event.path, name: path.basename(event.path) },
        });
        break;
      }
      case 'result':
        job.result = validateAnalysis(event.analysis);
        break;
      case 'error':
        job.error = String(event.message).slice(0, 2048);
        break;
      default:
        throw new Error('Unknown event');
    }
  }
  finish(job, status, error = null) {
    if (this.job !== job) return;
    clearTimeout(job.timer);
    this.job = null;
    this.update({
      status,
      analysis: status === 'complete' ? job.result : null,
      error,
    });
  }
  stop(status = 'cancelled', error = null) {
    const job = this.job;
    if (!job) return;
    // Kill the helper and its yt-dlp/ffmpeg descendants, not an unrelated tool process.
    if (job.child?.pid) {
      try {
        this.killGroup(job.child.pid);
      } catch (failure) {
        if (failure.code !== 'ESRCH') throw failure;
      }
    }
    this.finish(job, status, error);
  }
}

module.exports = {
  AnalyzerService,
  AUDIO_EXTENSIONS,
  validateAnalysis,
  validateYouTubeURL,
  parseYouTubeInput,
};
