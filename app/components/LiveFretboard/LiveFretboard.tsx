import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileVideo, Loader2, Maximize, Minimize } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useAgent } from '~/contexts/AgentContext';
import { useHighlight } from '~/contexts/HighlightContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { useSettings } from '~/contexts/SettingsContext';
import { getFretboardNoteMarkers } from '~/utils/fretNoteMarkers';
import { letterbox } from '~/utils/fretProjection';
import type {
  FretTrackerModelId,
  FretTrackerResult,
} from '~/types/fretTracker';
import { EMPTY_OVERLAY, buildOverlay } from './overlayGeometry';
import { displayMirror, modelFlip } from './orientation';
import { OverlayRenderer } from './overlayRenderer';
import {
  TRACKER_MODELS,
  TRACKER_MODEL_KEY,
  storedTrackerModel,
} from './trackerModels';

const FILE_SOURCE = 'file';
const INPUT = 640;

type Stats = {
  trackedFps: number;
  roundTripMs: number;
  modelMs: number | null;
  postMs: number | null;
  frames: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export default function LiveFretboard() {
  const { notes, pentatonicNotes } = useScaleKey();
  const { getHighlightedNotes } = useHighlight();
  const { settings } = useSettings();
  const { rootNotes, display } = useAgent();
  const highlightedNotes = getHighlightedNotes();
  const highlightKey = JSON.stringify(highlightedNotes);
  const markers = useMemo(
    () =>
      getFretboardNoteMarkers(
        {
          notes,
          pentatonicNotes,
          highlightedNotes: JSON.parse(highlightKey),
          cagedModeEnabled: settings.cagedModeEnabled,
          cagedShape: settings.cagedShape,
          showTextNotes: settings.showTextNotes,
          positions: display.positions,
        },
        rootNotes,
        1,
        24,
      ),
    [
      notes,
      pentatonicNotes,
      highlightKey,
      settings.cagedModeEnabled,
      settings.cagedShape,
      settings.showTextNotes,
      display.positions,
      rootNotes,
    ],
  );

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [source, setSource] = useState<string>('');
  const [fileName, setFileName] = useState<string>();
  const [fileURL, setFileURL] = useState<string>();
  const [mirroredView, setMirroredView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [model, setModel] = useState<FretTrackerModelId>(() =>
    storedTrackerModel(null),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [result, setResult] = useState<FretTrackerResult>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const stringCountRef = useRef(rootNotes.length);
  stringCountRef.current = rootNotes.length;
  // Model flip from the page-level Left-handed setting; display mirror from the
  // source (see ./orientation.ts).
  const flipRef = useRef(modelFlip(settings.isLefty));
  flipRef.current = modelFlip(settings.isLefty);
  const mirrorViewRef = useRef(false);
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    setModel(storedTrackerModel(localStorage.getItem(TRACKER_MODEL_KEY)));
  }, []);

  const refreshDevices = async () => {
    const all = await navigator.mediaDevices?.enumerateDevices?.();
    setDevices((all ?? []).filter(device => device.kind === 'videoinput'));
  };
  useEffect(() => {
    void refreshDevices();
  }, []);

  useEffect(
    () => () => {
      if (fileURL) URL.revokeObjectURL(fileURL);
    },
    [fileURL],
  );

  // Open the selected source and run the capture -> track -> draw loop.
  useEffect(() => {
    if (!running) return;
    const video = videoRef.current as VideoWithFrameCallback | null;
    const canvas = canvasRef.current;
    const api = window.jamFretTracker;
    if (!video || !canvas) return;
    if (!api) {
      setError('Live tracking needs the Jam Dashboard Mac app.');
      setRunning(false);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | undefined;
    let renderer: OverlayRenderer;
    try {
      renderer = new OverlayRenderer(canvas);
    } catch (cause) {
      setError((cause as Error).message);
      setRunning(false);
      return;
    }
    const capture = document.createElement('canvas');
    capture.width = INPUT;
    capture.height = INPUT;
    // GPU-backed, so only the 640x640 letterbox is read back, not the source frame.
    const context = capture.getContext('2d');
    let latest: FretTrackerResult | undefined;
    let inFlight = false;
    let reset = true;
    let lastT = -Infinity;
    let lastMirrored = flipRef.current;
    let lastModel = modelRef.current;
    let frames = 0;
    let fps = 0;
    let lastDone = 0;
    let frameHandle: number | undefined;
    let statsAt = 0;

    const send = () => {
      if (inFlight || !context || video.readyState < 2) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      const isFile = source === FILE_SOURCE;
      const t = isFile ? video.currentTime : performance.now() / 1000;
      const flip = flipRef.current;
      const trackerModel = modelRef.current;
      // loop, left-handed toggle or model switch (the helper restarts with the new model)
      if (t < lastT || flip !== lastMirrored || trackerModel !== lastModel) {
        reset = true;
        latest = undefined;
      }
      lastT = t;
      lastMirrored = flip;
      lastModel = trackerModel;
      const box = letterbox(width, height, INPUT);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = 'rgb(114, 114, 114)';
      context.fillRect(0, 0, INPUT, INPUT);
      if (flip) {
        context.setTransform(-1, 0, 0, 1, box.left + box.newWidth, box.top);
        context.drawImage(video, 0, 0, box.newWidth, box.newHeight);
      } else {
        context.drawImage(
          video,
          box.left,
          box.top,
          box.newWidth,
          box.newHeight,
        );
      }
      const pixels = context.getImageData(0, 0, INPUT, INPUT).data;
      const started = performance.now();
      inFlight = true;
      const frameReset = reset;
      reset = false;
      api
        .track({
          t,
          width,
          height,
          mirrored: flip,
          reset: frameReset,
          pixels,
          model: trackerModel,
        })
        .then(next => {
          if (cancelled || !next || next.model !== modelRef.current) return;
          latest = next;
          frames += 1;
          const now = performance.now();
          if (lastDone) {
            const instant = 1000 / Math.max(1, now - lastDone);
            fps = fps ? fps * 0.9 + instant * 0.1 : instant;
          }
          lastDone = now;
          if (now - statsAt > 250) {
            statsAt = now;
            setResult(next);
            setStats({
              trackedFps: fps,
              roundTripMs: now - started,
              modelMs: next.timingsMs.model ?? null,
              postMs: next.timingsMs.post ?? null,
              frames,
            });
          }
        })
        .catch(cause => {
          if (cancelled || (cause as { code?: string }).code === 'busy') return;
          setError(
            (cause as Error).message.replace(
              /^Error invoking remote method '[^']+': (Error: )?/,
              '',
            ),
          );
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const draw = () => {
      if (cancelled) return;
      if (video.readyState >= 2 && video.videoWidth) {
        send();
        const width = video.videoWidth;
        const height = video.videoHeight;
        const overlay =
          latest?.valid && latest.H
            ? buildOverlay({
                H: latest.H,
                nFrets: latest.nFrets,
                tau: latest.tau,
                markers: markersRef.current,
                stringCount: stringCountRef.current,
                width,
                mirrored: mirrorViewRef.current,
              })
            : EMPTY_OVERLAY;
        renderer.render(video, width, height, mirrorViewRef.current, overlay);
      }
      schedule();
    };
    const schedule = () => {
      if (cancelled) return;
      frameHandle = video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback(draw)
        : requestAnimationFrame(draw);
    };

    const open = async () => {
      setError(undefined);
      try {
        if (source === FILE_SOURCE) {
          if (!fileURL) throw new Error('Choose a video file.');
          video.srcObject = null;
          video.src = fileURL;
          video.loop = true;
          mirrorViewRef.current = displayMirror('file');
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: source ? { exact: source } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          });
          if (cancelled) return;
          video.removeAttribute('src');
          video.srcObject = stream;
          mirrorViewRef.current = displayMirror(
            'camera',
            stream.getVideoTracks()[0]?.getSettings().facingMode,
          );
          void refreshDevices();
        }
        setMirroredView(mirrorViewRef.current);
        video.muted = true;
        await video.play();
        schedule();
      } catch (cause) {
        if (cancelled) return;
        const message = (cause as Error).message;
        setError(
          (cause as Error).name === 'NotAllowedError'
            ? 'Camera access was denied. Allow Jam Dashboard in System Settings → Privacy & Security → Camera.'
            : message,
        );
        setRunning(false);
      }
    };
    void open();

    return () => {
      cancelled = true;
      if (frameHandle !== undefined) {
        if (video.cancelVideoFrameCallback)
          video.cancelVideoFrameCallback(frameHandle);
        cancelAnimationFrame(frameHandle);
      }
      video.pause();
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      renderer.dispose();
      void api.stop().catch(() => {});
    };
  }, [running, source, fileURL]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    setFileURL(URL.createObjectURL(file));
    setFileName(file.name);
    setSource(FILE_SOURCE);
    setRunning(true);
  };

  const chooseModel = (value: string) => {
    const next = storedTrackerModel(value);
    setModel(next);
    setError(undefined);
    localStorage.setItem(TRACKER_MODEL_KEY, next);
  };

  useEffect(() => {
    const update = () =>
      setFullscreen(
        !!viewRef.current && document.fullscreenElement === viewRef.current,
      );
    // Esc leaves full screen; Electron does not always do it for HTML fullscreen.
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        viewRef.current &&
        document.fullscreenElement === viewRef.current
      )
        void document.exitFullscreen();
    };
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void viewRef.current?.requestFullscreen().catch(cause => {
        setError(`Full screen is not available: ${(cause as Error).message}`);
      });
  };

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="live-fretboard">
      <p className="text-sm text-muted-foreground">
        Point a camera at your guitar neck to see the selected key, scale and
        coloring drawn on the frets. Tracking runs on this Mac; video never
        leaves it. Left-handed follows the Left-handed setting.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={source || 'default'}
          onValueChange={value => {
            if (value === FILE_SOURCE) {
              fileInputRef.current?.click();
              return;
            }
            setSource(value === 'default' ? '' : value);
          }}
        >
          <SelectTrigger className="h-9 w-[240px]" aria-label="Video source">
            <SelectValue placeholder="Camera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default camera</SelectItem>
            {devices
              .filter(device => device.deviceId)
              .map((device, i) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${i + 1}`}
                </SelectItem>
              ))}
            <SelectItem value={FILE_SOURCE}>
              {fileName ? `Video file: ${fileName}` : 'Video file…'}
            </SelectItem>
          </SelectContent>
        </Select>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          data-testid="live-fretboard-file"
          onChange={event => {
            chooseFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileVideo className="mr-1 h-4 w-4" /> Open video
        </Button>
        <Button
          size="sm"
          onClick={() => setRunning(value => !value)}
          disabled={source === FILE_SOURCE && !fileURL}
        >
          {running ? (
            'Stop'
          ) : (
            <>
              <Camera className="mr-1 h-4 w-4" /> Start
            </>
          )}
        </Button>
        <Select value={model} onValueChange={chooseModel}>
          <SelectTrigger
            className="h-9 w-[220px]"
            aria-label="Tracking model"
            data-testid="live-fretboard-model"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRACKER_MODELS.map(option => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p className="text-sm text-feedback-incorrect" role="alert">
          {error}
        </p>
      )}
      <div
        ref={viewRef}
        className={
          fullscreen
            ? 'relative flex h-full w-full items-center justify-center bg-black'
            : 'relative w-full overflow-hidden rounded-md bg-black'
        }
        data-testid="live-fretboard-view"
      >
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas
          ref={canvasRef}
          className={
            !running
              ? 'hidden'
              : fullscreen
                ? 'block h-full w-full object-contain'
                : 'block h-auto w-full'
          }
          data-testid="live-fretboard-canvas"
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 opacity-80 hover:opacity-100"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          data-testid="live-fretboard-fullscreen"
        >
          {fullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
        {running && !stats && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting tracker…
          </div>
        )}
        {!running && (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
            Choose a camera or video and press Start.
          </div>
        )}
      </div>
      {running && stats && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="live-fretboard-stats"
          data-frames={stats.frames}
          data-valid={result?.valid ? 'true' : 'false'}
          data-frets={result?.nFrets}
          data-model={result?.model}
          data-lefty={settings.isLefty ? 'true' : 'false'}
          data-mirrored-view={mirroredView ? 'true' : 'false'}
        >
          {result?.valid
            ? `Tracking ${result.nFrets} frets${result.held ? ' (holding)' : ''}`
            : 'Looking for a fretboard…'}{' '}
          · {stats.trackedFps.toFixed(0)} fps · round trip{' '}
          {stats.roundTripMs.toFixed(0)} ms
          {stats.modelMs !== null && ` · model ${stats.modelMs.toFixed(1)} ms`}
          {stats.postMs !== null && ` · post ${stats.postMs.toFixed(1)} ms`}
          {result && ` · ${result.model}`}
          {` · ${settings.isLefty ? 'left' : 'right'}-handed (Settings)`}
          {mirroredView && ' · mirrored view'}
        </p>
      )}
    </div>
  );
}
