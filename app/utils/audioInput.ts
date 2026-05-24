export interface AnalyserPipeline {
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
  cleanup: () => void;
}

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(
    (d) => d.kind === 'audioinput' && d.deviceId !== '',
  );
}

export async function createInputStream(
  deviceId?: string,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
}

const FFT_SIZE = 2048;

export function createAnalyserPipeline(
  stream: MediaStream,
): AnalyserPipeline {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;

  source.connect(analyser);

  const cleanup = () => {
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    context.close();
  };

  return { context, analyser, source, stream, cleanup };
}
