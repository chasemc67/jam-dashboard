import { useEffect, useState } from 'react';
import { Download, FolderOpen, Loader2, Music2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import type { AnalyzerReply, AnalyzerState } from '~/types/analyzer';

const statusLabels: Record<AnalyzerState['status'], string> = {
  idle: 'Ready for a song',
  downloading: 'Downloading and converting to MP3…',
  analyzing: 'Listening for tempo and key…',
  complete: 'Analysis complete',
  cancelled: 'Analysis cancelled',
  error: 'Could not finish analysis',
};

/** Kept mounted in the desktop tab so switching tools preserves the current input. */
export default function DesktopAnalyzer() {
  const { keyScale, setKeyScale } = useScaleKey();
  const [url, setURL] = useState('');
  const [state, setState] = useState<AnalyzerState>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const busy = state?.status === 'downloading' || state?.status === 'analyzing';
  const disabled = busy || pending;
  const result = state?.analysis;

  useEffect(() => {
    const api = window.jamDesktop;
    let alive = true;
    // Snapshot requests and progress events may arrive in either order.
    const receive = (next: AnalyzerState) => {
      if (alive)
        setState(previous =>
          !previous || next.revision >= previous.revision ? next : previous,
        );
    };
    const unsubscribe = api?.onAnalyzerState(receive);
    api
      ?.getAnalyzerState()
      .then(receive)
      .catch(() => {
        if (alive)
          setError(
            'Could not connect to the local analyzer. Reopen Jam Dashboard to try again.',
          );
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  async function run(action: () => Promise<AnalyzerReply> | undefined) {
    setError(undefined);
    setPending(true);
    try {
      const reply = await action();
      if (!reply?.ok)
        setError(
          reply?.error ?? 'Open the Jam Dashboard Mac app to analyze a song.',
        );
    } catch {
      setError(
        'The analyzer could not complete that action. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Song analyzer" className="p-4">
      <h2 className="text-lg font-semibold">YouTube Analyzer</h2>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Analyze a YouTube song or local audio, then use its key for your jam.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <form
            className="space-y-3"
            onSubmit={event => {
              event.preventDefault();
              if (!disabled)
                void run(() => window.jamDesktop?.startYouTube(url));
            }}
          >
            <label htmlFor="analyzer-url" className="text-sm font-medium">
              YouTube URL
            </label>
            <Input
              id="analyzer-url"
              value={url}
              onChange={event => setURL(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={disabled}
              autoComplete="off"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span
                className="min-w-0 flex-1 truncate"
                title={state?.destination}
              >
                Save to {state?.destination ?? 'Desktop'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  void run(() => window.jamDesktop?.chooseDestination())
                }
              >
                Change
              </Button>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                disabled ||
                !url.trim() ||
                !state?.tools.ytDlp ||
                !state?.tools.ffmpeg
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Download MP3 & Analyze
            </Button>
          </form>
          <div
            className="rounded-xl border border-dashed border-border p-5 text-center"
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
            }}
            onDrop={event => {
              event.preventDefault();
              if (disabled) return;
              const file = event.dataTransfer.files[0];
              if (file)
                void run(() => window.jamDesktop?.analyzeDroppedFile(file));
              else {
                const text = event.dataTransfer.getData('text/plain');
                if (text) setURL(text.trim());
              }
            }}
          >
            <Music2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm">Or drop an audio file here</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={disabled || !state?.tools.ffmpeg}
              onClick={() => void run(() => window.jamDesktop?.chooseAudio())}
            >
              Choose audio file
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              MP3, WAV, M4A, FLAC and more
            </p>
          </div>
          {state && (!state.tools.ffmpeg || !state.tools.ytDlp) && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              {!state.tools.ffmpeg
                ? 'Audio analysis needs ffmpeg.'
                : 'YouTube downloads need yt-dlp. You can still analyze local audio.'}
              <p className="mt-2 text-xs">
                Install with <code>brew install yt-dlp ffmpeg</code>, then{' '}
                <button
                  className="underline"
                  onClick={() => {
                    void window.jamDesktop
                      ?.getAnalyzerState()
                      .then(next =>
                        setState(previous =>
                          !previous || next.revision >= previous.revision
                            ? next
                            : previous,
                        ),
                      )
                      .catch(() =>
                        setError('Could not check installed tools.'),
                      );
                  }}
                >
                  check again
                </button>
                .
              </p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {state
                ? statusLabels[state.status]
                : 'Connecting to the local analyzer…'}
            </span>
            {busy && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() =>
                  void run(() => window.jamDesktop?.cancelAnalysis())
                }
              >
                Cancel
              </Button>
            )}
          </div>
          {(error || state?.error) && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error || state?.error}
            </p>
          )}
          {result && (
            <section
              className="space-y-4 rounded-xl border bg-card p-4"
              aria-label="Song analysis result"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tempo
                </p>
                <p className="mt-1 text-3xl font-semibold">
                  {result.bpm.toFixed(1)}{' '}
                  <span className="text-sm text-muted-foreground">BPM</span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Detected key
                </p>
                <p className="text-lg font-medium">{result.musicalKey}</p>
                {result.keyScale ? (
                  <Button
                    className="w-full"
                    variant={
                      keyScale === result.keyScale ? 'secondary' : 'default'
                    }
                    onClick={() => setKeyScale(result.keyScale!)}
                  >
                    {keyScale === result.keyScale
                      ? `Selected: ${result.musicalKey}`
                      : `Use ${result.musicalKey}`}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No clear key was detected.
                  </p>
                )}
                {result.relativeMajorKeyScale && (
                  <Button
                    className="h-auto w-full whitespace-normal"
                    variant="outline"
                    onClick={() => setKeyScale(result.relativeMajorKeyScale!)}
                  >
                    {keyScale === result.relativeMajorKeyScale
                      ? 'Selected: '
                      : 'Use relative major: '}
                    {result.relativeMajorKey}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Choosing a key updates the fretboard, chord explorer, and ear
                  training.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Tempo confidence: {Math.round(result.tempoConfidence * 100)}% ·
                Key confidence: {Math.round(result.keyConfidence * 100)}%. These
                are estimates; half/double tempo and ambiguous harmony may need
                your ear.
              </p>
            </section>
          )}
          {state?.file && (
            <div className="space-y-2 text-sm">
              <p className="break-words font-medium">{state.file.name}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void run(() => window.jamDesktop?.revealAudio())}
              >
                Show in Finder
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Audio stays on this Mac. You can switch tabs while analysis runs.
            Only download audio you have permission to save.
          </p>
        </div>
      </div>
    </section>
  );
}
