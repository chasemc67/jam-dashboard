const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Paths are owned by main. IPC accepts opaque session ids and fixed stream names only.
class RecordingService {
  constructor({ directory, appVersion, reveal }) {
    Object.assign(this, { directory, appVersion, reveal });
    this.sessions = new Map();
  }
  async start(metadata) {
    if (this.starting || [...this.sessions.values()].some(s => !s.stopped))
      throw new Error('Already recording.');
    if (
      !metadata ||
      !/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(v1|v3|v4q832)$/.test(
        metadata.folderName,
      )
    )
      throw new Error('Invalid recording folder.');
    const encoded = JSON.stringify(metadata);
    if (encoded.length > 65536) throw new Error('Invalid metadata.');
    this.starting = true;
    try {
      await fs.mkdir(this.directory, { recursive: true });
      const folder = await fs.mkdtemp(
        path.join(this.directory, metadata.folderName + '_'),
      );
      const id = randomUUID();
      const handles = {};
      try {
        for (const name of ['raw', 'overlay', 'frames', 'settingChanges'])
          handles[name] = await fs.open(
            path.join(
              folder,
              ['frames', 'settingChanges'].includes(name)
                ? `${name}.jsonl`
                : `${name}.webm`,
            ),
            'wx',
          );
      } catch (error) {
        await Promise.all(Object.values(handles).map(h => h.close()));
        throw error;
      }
      this.sessions.set(id, {
        folder,
        handles,
        metadata: { ...metadata, appVersion: this.appVersion },
        count: 0,
        tail: Promise.resolve(),
        stopped: false,
      });
      return { id, appVersion: this.appVersion };
    } finally {
      this.starting = false;
    }
  }

  get(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Unknown recording.');
    return s;
  }
  enqueue(s, fn) {
    const work = s.tail.then(fn);
    s.tail = work.catch(error => {
      s.error = error;
    });
    return work;
  }
  append(id, name, data) {
    const s = this.get(id);
    if (
      s.stopped ||
      !['raw', 'overlay', 'frames', 'settingChanges'].includes(name)
    )
      throw new Error('Recording is closed or stream invalid.');
    let buffer;
    if (name === 'frames' || name === 'settingChanges') {
      if (
        !data ||
        !Number.isFinite(data.t_ms) ||
        (name === 'frames'
          ? !Number.isInteger(data.frameIndex)
          : data.t_ms < 0 ||
            typeof data.key !== 'string' ||
            !data.key ||
            !Object.hasOwn(data, 'from') ||
            !Object.hasOwn(data, 'to'))
      )
        throw new Error('Invalid frame.');
      buffer = Buffer.from(JSON.stringify(data) + '\n');
    } else {
      if (!(data instanceof Uint8Array))
        throw new Error('Invalid video chunk.');
      buffer = Buffer.from(data);
    }
    if (buffer.length > 16 * 1024 * 1024)
      throw new Error('Recording chunk too large.');
    return this.enqueue(s, async () => {
      if (s.error) throw s.error;
      await s.handles[name].writeFile(buffer);
      if (name === 'frames') s.count++;
    });
  }
  async saveSidecar(s, note) {
    if (typeof note !== 'string' || note.length > 100000)
      throw new Error('Note too long.');
    const temporary = path.join(s.folder, 'session.json.tmp');
    async function* parts() {
      yield JSON.stringify({
        ...s.metadata,
        note,
        error: s.error?.message ?? null,
      }).slice(0, -1);
      for (const name of ['settingChanges', 'frames']) {
        yield `,"${name}":[`;
        let first = true;
        // Convert the append-only JSONL journal without loading the session into memory.
        const readline = require('node:readline').createInterface({
          input: createReadStream(path.join(s.folder, `${name}.jsonl`)),
          crlfDelay: Infinity,
        });
        for await (const line of readline) {
          if (!line) continue;
          yield (first ? '' : ',') + line;
          first = false;
        }
        yield ']';
      }
      yield '}';
    }
    await pipeline(parts(), createWriteStream(temporary));
    await fs.rename(temporary, path.join(s.folder, 'session.json'));
    await fs.writeFile(path.join(s.folder, 'note.txt'), note, 'utf8');
  }
  stop(id, note = '', error) {
    if (
      error !== undefined &&
      (typeof error !== 'string' || error.length > 1000)
    )
      throw new Error('Invalid recording error.');
    const s = this.get(id);
    if (s.stopped) return s.tail;
    s.stopped = true;
    if (error) s.error = new Error(error);
    return this.enqueue(s, async () => {
      await Promise.all(Object.values(s.handles).map(h => h.close()));
      await this.saveSidecar(s, note);
      if (s.error) throw s.error;
    });
  }
  note(id, note) {
    const s = this.get(id);
    if (!s.stopped)
      throw new Error('Stop recording before editing the saved note.');
    return this.enqueue(s, () => this.saveSidecar(s, note));
  }
  show(id) {
    this.reveal(path.join(this.get(id).folder, 'session.json'));
  }
  async close() {
    await Promise.allSettled(
      [...this.sessions].map(([id, s]) => (s.stopped ? s.tail : this.stop(id))),
    );
  }
}
function registerRecordingIPC(handle, service) {
  for (const method of ['start', 'append', 'stop', 'note', 'show'])
    handle(
      `jam:recording-${method}`,
      (...args) => service[method](...args),
      true,
    );
}
module.exports = { RecordingService, registerRecordingIPC };
