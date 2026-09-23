import {
  AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY,
  loadVoiceDeviceId,
  mapVoiceMicError,
  pickRecorderMimeType,
  rmsLevel,
  saveVoiceDeviceId,
  transcribeVoiceRecording,
  voiceAudioFilename,
  voiceStreamConstraints,
} from './voice-mic';

test('persists the chat voice device separately from Note Detector settings', () => {
  localStorage.clear();
  expect(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY).toBe(
    'jam-agent-chat-voice-device-id',
  );
  expect(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY).not.toBe(
    'jam-dashboard-settings',
  );
  expect(loadVoiceDeviceId()).toBeNull();
  saveVoiceDeviceId('mic-chat');
  expect(localStorage.getItem(AGENT_CHAT_VOICE_DEVICE_STORAGE_KEY)).toBe(
    'mic-chat',
  );
  expect(loadVoiceDeviceId()).toBe('mic-chat');
  saveVoiceDeviceId(null);
  expect(loadVoiceDeviceId()).toBeNull();
});

test('voice streams use speech processing, not guitar-input constraints', () => {
  expect(voiceStreamConstraints()).toEqual({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  expect(voiceStreamConstraints('device-2')).toEqual({
    audio: {
      deviceId: { exact: 'device-2' },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
});

test('pickRecorderMimeType prefers opus webm then mp4', () => {
  expect(pickRecorderMimeType(type => type === 'audio/mp4')).toBe('audio/mp4');
  expect(pickRecorderMimeType(type => type.startsWith('audio/webm'))).toBe(
    'audio/webm;codecs=opus',
  );
  expect(pickRecorderMimeType(() => false)).toBe('');
  expect(voiceAudioFilename('audio/mp4')).toBe('voice.mp4');
  expect(voiceAudioFilename('audio/webm;codecs=opus')).toBe('voice.webm');
});

test('mapVoiceMicError explains permission, missing, and busy devices', () => {
  const denied = new DOMException('denied', 'NotAllowedError');
  expect(mapVoiceMicError(denied)).toMatch(/permission denied/i);
  expect(mapVoiceMicError(new DOMException('gone', 'NotFoundError'))).toMatch(
    /no microphone/i,
  );
  expect(
    mapVoiceMicError(new DOMException('busy', 'NotReadableError')),
  ).toMatch(/busy/i);
});

test('rmsLevel is 0 for silence and higher for a signal', () => {
  expect(rmsLevel([])).toBe(0);
  expect(rmsLevel([0, 0, 0])).toBe(0);
  expect(rmsLevel([1, -1, 1, -1])).toBe(1);
});

test('transcribeVoiceRecording posts audio and returns text', async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ text: 'Show B major.' }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });
    await expect(transcribeVoiceRecording(blob)).resolves.toBe('Show B major.');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent-transcribe',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('audio')).toBeInstanceOf(Blob);
  } finally {
    global.fetch = originalFetch;
  }
});
