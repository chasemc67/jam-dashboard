import { act, renderHook } from '@testing-library/react';
import { transcribeVoiceRecording } from '~/agent/voice-mic';
import { useAgentChatVoice } from './useAgentChatVoice';

jest.mock('~/agent/voice-mic', () => ({
  ...jest.requireActual('~/agent/voice-mic'),
  isVoiceInputSupported: () => true,
  pickRecorderMimeType: () => 'audio/webm',
  listVoiceInputDevices: async () => ({ granted: true, devices: [] }),
  createVoiceInputStream: async () => ({
    getTracks: () => [{ stop: () => {} }],
    getAudioTracks: () => [],
  }),
  trackDeviceId: () => null,
  transcribeVoiceRecording: jest.fn(),
}));

const transcribe = transcribeVoiceRecording as jest.MockedFunction<
  typeof transcribeVoiceRecording
>;

let micLevel = 0;

class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(timeslice: number) {
    this.state = 'recording';
    this.timer = setInterval(() => this.emit(), timeslice);
  }

  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    if (this.timer) clearInterval(this.timer);
    this.emit();
    queueMicrotask(() => this.onstop?.());
  }

  private emit() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) });
  }
}

class FakeAudioContext {
  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      getFloatTimeDomainData: (buffer: Float32Array) => buffer.fill(micLevel),
    };
  }
  close() {
    return Promise.resolve();
  }
}

beforeAll(() => {
  Object.assign(globalThis, {
    MediaRecorder: FakeMediaRecorder,
    AudioContext: FakeAudioContext,
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  micLevel = 0;
  transcribe.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function setup(initialDraft: string) {
  const drafts: string[] = [];
  const hook = renderHook(
    ({ draft }) =>
      useAgentChatVoice({
        draft,
        onDraftChange: next => {
          drafts.push(next);
          hook.rerender({ draft: next });
        },
      }),
    { initialProps: { draft: initialDraft } },
  );
  return { hook, drafts, latest: () => drafts[drafts.length - 1] };
}

async function stopListening(hook: ReturnType<typeof setup>['hook']) {
  let final: string | null = null;
  await act(async () => {
    const pending = hook.result.current.onStop();
    await jest.advanceTimersByTimeAsync(0);
    final = await pending;
  });
  return final;
}

async function startListening(hook: ReturnType<typeof setup>['hook']) {
  await act(async () => {
    hook.result.current.onStart();
    await Promise.resolve();
  });
  await advance(0);
  expect(hook.result.current.status).toBe('recording');
}

test('streams interim text into the draft and appends to existing text', async () => {
  const { hook, latest } = setup('Show me');
  transcribe
    .mockResolvedValueOnce('B major')
    .mockResolvedValueOnce('B major please');
  await startListening(hook);

  micLevel = 0.2;
  await advance(1600);
  expect(latest()).toBe('Show me B major');
  expect(hook.result.current.status).toBe('recording');

  const final = await stopListening(hook);
  expect(final).toBe('Show me B major please');
  expect(latest()).toBe('Show me B major please');
  expect(hook.result.current.status).toBe('idle');
  expect(transcribe).toHaveBeenCalledTimes(2);
});

test('empty composer is filled; pauses commit segments in order', async () => {
  const { hook, latest } = setup('');
  // Each fake chunk is one byte, so blob size tells the segments apart.
  transcribe.mockImplementation(async blob =>
    blob.size > 4 ? 'first part' : 'second part',
  );
  await startListening(hook);

  micLevel = 0.2;
  await advance(3200);
  micLevel = 0;
  await advance(1000);
  expect(latest()).toBe('first part');

  micLevel = 0.2;
  await advance(400);
  await stopListening(hook);
  expect(latest()).toBe('first part second part');
});

test('stopping keeps the draft and never clears it for sending', async () => {
  const { hook, drafts } = setup('Keep this');
  transcribe.mockResolvedValue('and this');
  await startListening(hook);
  micLevel = 0.2;
  await advance(400);
  await stopListening(hook);
  expect(drafts).not.toContain('');
  expect(drafts[drafts.length - 1]).toBe('Keep this and this');
});

test('silence only reports no speech and leaves the draft alone', async () => {
  const { hook, latest } = setup('Draft');
  transcribe.mockRejectedValue(new Error('No speech detected. Try again.'));
  await startListening(hook);
  await advance(1000);
  await stopListening(hook);
  expect(latest()).toBe('Draft');
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.error).toBe('No speech detected. Try again.');
});

test('cancel restores the draft from before dictation', async () => {
  const { hook, latest } = setup('Original');
  transcribe.mockResolvedValue('spoken words');
  await startListening(hook);
  micLevel = 0.2;
  await advance(1600);
  expect(latest()).toBe('Original spoken words');
  act(() => hook.result.current.onCancel());
  expect(latest()).toBe('Original');
  expect(hook.result.current.status).toBe('idle');
});
