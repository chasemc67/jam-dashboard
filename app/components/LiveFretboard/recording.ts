import type { FretTrackerResult, HandMask } from '~/types/fretTracker';
import type { useSettings } from '~/contexts/SettingsContext';
import type { Display } from '../../../shared/agent/contract';
import type { HighlightedNote } from '~/utils/fretNoteMarkers';
import type { OverlayGeometry } from './overlayGeometry';

export type RecordingSettings = {
  model: string;
  leftHanded: boolean;
  mirrored: boolean;
  handCutout: { enabled: boolean; option: string; opacity: number };
  width: number;
  height: number;
  source: string;
  fullscreen: boolean;
  camera: {
    deviceId: string | null;
    label: string | null;
    requested: MediaTrackConstraints;
    actual: {
      width: number | null;
      height: number | null;
      frameRate: number | null;
    };
  };
  overlay: {
    key: string;
    scale: string;
    notes: string[];
    pentatonicNotes: string[];
    highlightedNotes: HighlightedNote[];
    rootNotes: string[];
    display: Display;
    options: ReturnType<typeof useSettings>['settings'];
    fretRange: { from: number; to: number };
  };
};

type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };
export type SettingChange = {
  t_ms: number;
  key: string;
  from: JSONValue;
  to: JSONValue;
};

/** JSON ownership boundary: no live React state or mutable browser objects retained. */
export function snapshotSettings(
  settings: RecordingSettings,
): RecordingSettings {
  return JSON.parse(JSON.stringify(settings));
}

export function settingChanges(
  from: RecordingSettings,
  to: RecordingSettings,
  t_ms: number,
): SettingChange[] {
  const changes: SettingChange[] = [];
  const object = (value: JSONValue): value is { [key: string]: JSONValue } =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const visit = (before: JSONValue, after: JSONValue, key: string) => {
    if (object(before) && object(after)) {
      for (const child of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ]))
        visit(
          before[child] ?? null,
          after[child] ?? null,
          key ? `${key}.${child}` : child,
        );
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ t_ms, key, from: before, to: after });
    }
  };
  visit(
    snapshotSettings(from) as unknown as JSONValue,
    snapshotSettings(to) as unknown as JSONValue,
    '',
  );
  return changes;
}
export function recordingFolder(date: Date, model: string) {
  return `${date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}_${model.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
export function sessionMetadata(
  settings: RecordingSettings,
  date: Date,
  clock: number,
) {
  return {
    schemaVersion: 2,
    ...snapshotSettings(settings),
    settings: snapshotSettings(settings),
    startedAt: date.toISOString(),
    performanceStart: clock,
    folderName: recordingFolder(date, settings.model),
    mimeType: 'video/webm;codecs=vp8',
    note: '',
  };
}
export function recordingFrame(input: {
  now: number;
  start: number;
  frameIndex: number;
  mediaTime: number | null;
  settings: RecordingSettings;
  result?: FretTrackerResult;
  overlay: OverlayGeometry;
  mask: HandMask | null;
  maskTransform: number[];
  inferenceCapturedAt: number | null;
  inferenceMediaTime: number | null;
  colors: Record<string, number[]>;
  encoderStart_ms?: { raw: number | null; overlay: number | null };
}) {
  const { now, start, result, ...rest } = input;
  return {
    ...rest,
    t_ms: now - start,
    inferenceCapturedAt:
      input.inferenceCapturedAt === null
        ? null
        : input.inferenceCapturedAt - start,
    keypoints: result?.kpts ?? null,
    confidence: result?.boardScore ?? null,
    tracking: result ? { ...result, handMask: undefined } : null,
  };
}
export type RecordingAPI = {
  start: (
    metadata: ReturnType<typeof sessionMetadata>,
  ) => Promise<{ id: string; appVersion: string }>;
  append: (
    id: string,
    stream: 'raw' | 'overlay' | 'frames' | 'settingChanges',
    data: Uint8Array | ReturnType<typeof recordingFrame> | SettingChange,
  ) => Promise<void>;
  stop: (id: string, note: string, error?: string) => Promise<void>;
  note: (id: string, note: string) => Promise<void>;
  show: (id: string) => Promise<void>;
};

/** Serial IPC with a hard backlog limit; stop instead of accumulating a long session in RAM. */
export class FretboardRecording {
  readonly start = performance.now();
  readonly startedAt = new Date();
  id = '';
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private failure: Error | undefined;
  private stopped = false;
  private stopping?: Promise<void>;
  private index = 0;
  private settings?: RecordingSettings;
  private encoderStart_ms: { raw: number | null; overlay: number | null } = {
    raw: null,
    overlay: null,
  };
  private recorders: MediaRecorder[] = [];
  private done: Promise<void>[] = [];
  private overlayStream?: MediaStream;
  constructor(
    private api: RecordingAPI,
    private onError: (error: Error) => void,
  ) {}
  async open(
    raw: MediaStream,
    canvas: HTMLCanvasElement,
    settings: RecordingSettings,
  ) {
    if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8'))
      throw new Error('WebM recording is unavailable.');
    this.settings = snapshotSettings(settings);
    this.overlayStream = canvas.captureStream();
    const streams = [raw, this.overlayStream];
    // Start both encoders on the same performance clock. Writes await the session id.
    const ready = this.api.start(
      sessionMetadata(settings, this.startedAt, this.start),
    );
    this.tail = ready.then(value => {
      this.id = value.id;
    });
    try {
      streams.forEach((stream, i) => {
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8',
        });
        this.recorders.push(recorder);
        let finish!: () => void;
        this.done.push(
          new Promise<void>(resolve => {
            finish = resolve;
            recorder.onstop = () => {
              resolve();
              if (!this.stopped)
                this.fail(new Error('Recording stopped: camera stream ended.'));
            };
          }),
        );
        recorder.ondataavailable = event => {
          if (event.data.size)
            this.queue(async () =>
              this.api.append(
                this.id,
                i === 0 ? 'raw' : 'overlay',
                new Uint8Array(await event.data.arrayBuffer()),
              ),
            );
        };
        recorder.onerror = () => this.fail(new Error('Video encoder failed.'));
        try {
          this.encoderStart_ms[i === 0 ? 'raw' : 'overlay'] =
            performance.now() - this.start;
          recorder.start(1000);
        } catch (error) {
          finish();
          throw error;
        }
      });
      await this.tail;
    } catch (error) {
      this.fail(error as Error);
      throw error;
    }
  }
  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    this.onError(error);
  }
  private queue(work: () => Promise<void>) {
    if (++this.pending > 120) {
      this.pending--;
      this.fail(new Error('Recording stopped: disk cannot keep up.'));
      return;
    }
    this.tail = this.tail
      .then(work)
      .catch(error => this.fail(error))
      .finally(() => {
        this.pending--;
      });
  }
  updateSettings(settings: RecordingSettings, now = performance.now()) {
    if (this.stopped || !this.settings) return;
    const next = snapshotSettings(settings);
    for (const change of settingChanges(this.settings, next, now - this.start))
      this.queue(() => this.api.append(this.id, 'settingChanges', change));
    this.settings = next;
  }
  frame(
    input: Omit<Parameters<typeof recordingFrame>[0], 'start' | 'frameIndex'>,
  ) {
    if (this.stopped) return;
    this.updateSettings(input.settings, input.now);
    const frame = recordingFrame({
      ...input,
      start: this.start,
      frameIndex: this.index++,
      encoderStart_ms: { ...this.encoderStart_ms },
    });
    this.queue(() => this.api.append(this.id, 'frames', frame));
  }
  stop(note: string) {
    if (this.stopping) return this.stopping;
    this.stopped = true;
    for (const recorder of this.recorders)
      if (recorder.state !== 'inactive') recorder.stop();
    this.stopping = (async () => {
      await Promise.all(this.done);
      try {
        await this.tail;
      } finally {
        this.overlayStream?.getTracks().forEach(track => track.stop());
      }
      if (this.id) await this.api.stop(this.id, note, this.failure?.message);
      if (this.failure) throw this.failure;
    })();
    return this.stopping;
  }
}
