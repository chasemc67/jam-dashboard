import {
  snapshotSettings,
  settingChanges,
  type RecordingSettings,
  recordingFolder,
  sessionMetadata,
  recordingFrame,
} from './recording';
import { EMPTY_OVERLAY } from './overlayGeometry';
const settings: RecordingSettings = {
  source: 'camera-1',
  fullscreen: false,
  camera: {
    deviceId: 'camera-1',
    label: 'Front camera',
    requested: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    actual: { width: 640, height: 480, frameRate: 24 },
  },
  overlay: {
    key: 'C',
    scale: 'major',
    notes: ['C', 'D', 'E'],
    pentatonicNotes: ['C', 'D'],
    highlightedNotes: [{ note: 'C', color: 'red' }],
    rootNotes: ['E', 'B', 'G', 'D', 'A', 'E'],
    display: { kind: 'scale' },
    options: {
      isLefty: true,
      numberOfFrets: 12,
      numberOfStrings: 6,
      showTextNotes: true,
      quickColors: 'scale',
      cagedModeEnabled: false,
      cagedShape: 'C',
      showMajorMinorScales: true,
      showHarmonicMelodicScales: false,
      showModes: false,
    },
    fretRange: { from: 1, to: 24 },
  },
  model: 'v3',
  leftHanded: true,
  mirrored: true,
  handCutout: { enabled: true, option: 'skin', opacity: 0.5 },
  width: 1280,
  height: 720,
};
test('folder names are stable UTC timestamps and cannot traverse directories', () => {
  expect(recordingFolder(new Date('2026-10-12T12:34:56Z'), 'v3')).toBe(
    '2026-10-12_12-34-56_v3',
  );
  expect(recordingFolder(new Date(0), '../../bad')).not.toMatch(/[./]/);
});
test('session preserves orientation, cutout and raw dimensions independently', () => {
  expect(sessionMetadata(settings, new Date(0), 42)).toMatchObject({
    ...settings,
    performanceStart: 42,
    startedAt: '1970-01-01T00:00:00.000Z',
    schemaVersion: 2,
  });
});
test('frames use performance time and preserve exact displayed geometry and masks', () => {
  const overlay = {
    ...EMPTY_OVERLAY,
    wires: [
      [
        [5, 10],
        [9, 20],
      ],
    ],
  } as typeof EMPTY_OVERLAY;
  const frame = recordingFrame({
    now: 1123,
    start: 1000,
    frameIndex: 3,
    mediaTime: 25.6,
    settings,
    overlay,
    mask: { width: 1, height: 1, alpha: '/w==' },
    maskTransform: [-1, 1, 1, 0],
    inferenceCapturedAt: 1080,
    inferenceMediaTime: 25.5,
    colors: {},
  });
  expect(frame).toMatchObject({
    t_ms: 123,
    inferenceCapturedAt: 80,
    frameIndex: 3,
    mediaTime: 25.6,
    keypoints: null,
    confidence: null,
  });
  expect(frame.overlay).toBe(overlay);
  expect(frame.mask?.alpha).toBe('/w==');
  expect(frame.settings.mirrored).toBe(true);
});

import { FretboardRecording, type RecordingAPI } from './recording';

test('stop waits for final encoder chunks and IPC writes without stopping the camera', async () => {
  const original = globalThis.MediaRecorder;
  const encoders: FakeRecorder[] = [];
  class FakeRecorder {
    static isTypeSupported() {
      return true;
    }
    state = 'inactive';
    onstop?: () => void;
    ondataavailable?: (event: {
      data: { size: number; arrayBuffer: () => Promise<ArrayBuffer> };
    }) => void;
    constructor() {
      encoders.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({
          data: {
            size: 1,
            arrayBuffer: async () => new Uint8Array([7]).buffer,
          },
        });
        this.onstop?.();
      });
    }
  }
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: FakeRecorder,
  });
  try {
    const events: string[] = [];
    const changes: unknown[] = [];
    const cameraStop = jest.fn();
    const overlayStop = jest.fn();
    const raw = {
      getTracks: () => [{ stop: cameraStop }],
    } as unknown as MediaStream;
    const canvas = {
      captureStream: () => ({ getTracks: () => [{ stop: overlayStop }] }),
    } as unknown as HTMLCanvasElement;
    const api: RecordingAPI = {
      start: async () => ({ id: 'session', appVersion: '1' }),
      append: async (_id, stream, data) => {
        if (stream === 'settingChanges') changes.push(data);
        await Promise.resolve();
        events.push(stream);
      },
      stop: async (_id, note) => {
        events.push(`stop:${note}`);
      },
      note: async () => {},
      show: async () => {},
    };
    const onError = jest.fn();
    const recording = new FretboardRecording(api, onError);
    await recording.open(raw, canvas, settings);
    const changed = snapshotSettings(settings);
    changed.overlay.key = 'D';
    recording.updateSettings(changed, recording.start + 50);
    recording.updateSettings(changed, recording.start + 51);
    changed.overlay.key = 'E';
    recording.updateSettings(changed, recording.start + 60);
    changed.camera.actual.frameRate = 25;
    recording.frame({
      now: recording.start + 70,
      mediaTime: 1,
      settings: changed,
      overlay: EMPTY_OVERLAY,
      mask: null,
      maskTransform: [1, 1, 0, 0],
      inferenceCapturedAt: null,
      inferenceMediaTime: null,
      colors: {},
    });
    // Camera selection ends the old session, but must survive without another frame.
    changed.source = 'camera-2';
    recording.updateSettings(changed, recording.start + 80);
    await Promise.all([recording.stop('keep'), recording.stop('ignored')]);
    expect(events).toEqual([
      'settingChanges',
      'settingChanges',
      'settingChanges',
      'frames',
      'settingChanges',
      'raw',
      'overlay',
      'stop:keep',
    ]);
    expect(changes).toEqual([
      { t_ms: 50, key: 'overlay.key', from: 'C', to: 'D' },
      { t_ms: 60, key: 'overlay.key', from: 'D', to: 'E' },
      { t_ms: 70, key: 'camera.actual.frameRate', from: 24, to: 25 },
      { t_ms: 80, key: 'source', from: 'camera-1', to: 'camera-2' },
    ]);
    recording.updateSettings(settings, recording.start + 100);
    expect(changes).toHaveLength(4);
    expect(encoders.every(encoder => encoder.state === 'inactive')).toBe(true);
    expect(cameraStop).not.toHaveBeenCalled();
    expect(overlayStop).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: original,
    });
  }
});

test('initial settings are a complete independent JSON snapshot', () => {
  const live = snapshotSettings(settings);
  const metadata = sessionMetadata(live, new Date(0), 10);
  expect(metadata.settings).toEqual(settings);
  live.overlay.notes.push('F');
  live.camera.actual.frameRate = 60;
  live.handCutout.opacity = 1;
  expect(metadata.settings).toEqual(settings);
});

test('diff logs nested options, arrays, camera data and optional removals without duplicates', () => {
  const before = snapshotSettings(settings);
  before.overlay.display.positions = [{ string: 1, fret: 2 }];
  const after = snapshotSettings(settings);
  after.model = 'v4q832';
  after.handCutout.enabled = false;
  after.handCutout.option = 'other';
  after.handCutout.opacity = 0.2;
  after.leftHanded = false;
  after.mirrored = false;
  after.overlay.key = 'D';
  after.overlay.scale = 'minor';
  after.overlay.options.showTextNotes = false;
  after.overlay.rootNotes = ['D'];
  after.camera.deviceId = 'camera-2';
  after.camera.label = 'Back camera';
  after.camera.actual.frameRate = 60;
  after.camera.requested.frameRate = { ideal: 60 };
  const changes = settingChanges(before, after, 123);
  expect(changes).toEqual(
    expect.arrayContaining([
      { t_ms: 123, key: 'model', from: 'v3', to: 'v4q832' },
      { t_ms: 123, key: 'camera.actual.frameRate', from: 24, to: 60 },
      {
        t_ms: 123,
        key: 'overlay.rootNotes',
        from: settings.overlay.rootNotes,
        to: ['D'],
      },
      {
        t_ms: 123,
        key: 'overlay.display.positions',
        from: [{ string: 1, fret: 2 }],
        to: null,
      },
    ]),
  );
  expect(changes).toHaveLength(15);
  expect(changes.every(change => change.t_ms === 123)).toBe(true);
  expect(settingChanges(after, snapshotSettings(after), 124)).toEqual([]);
});
