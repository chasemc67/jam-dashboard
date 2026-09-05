# Local song analysis helper

`MusicCore` and the original CLI were imported from `YouTubeMusicAnalyzer` commit
`e7acc4c62e5b11801e9a67ef510827bee5b797ad`. The original repository is unchanged.
Jam Dashboard now owns this copy; building does not require the sibling repo.

Only the headless `MusicAnalyzerCLI` is packaged. Its Swift code downloads and
converts audio with yt-dlp/ffmpeg and estimates BPM/key locally. The UI lives in
Jam Dashboard's React drawer; no separate SwiftUI app is built or launched.

## Protocol

The helper writes one JSON event per stdout line (progress, downloaded file,
result, or error). The Electron main process validates these events and owns a
single job, retained snapshot, cancellation, and timeout. The typed renderer
contract lives in `app/types/analyzer.ts`.

```sh
MusicAnalyzerCLI --json download 'https://youtu.be/VIDEO_ID' /path/to/destination
MusicAnalyzerCLI --json analyze /path/to/song.mp3
MusicAnalyzerCLI /path/to/song.mp3  # human-readable output for development
```

A result includes BPM, confidence estimates, a display key (such as
`F♯ / G♭ minor`), a Tonal-compatible `keyScale` (`F# minor`), and the relative
major label/selection when applicable. Unknown keys have a null selection and
cannot overwrite the dashboard key. The UI applies a selection only when clicked.

`ProcessRunner` redirects tool output to temporary files to avoid pipe deadlocks.
Electron gives every job its own temporary directory and deletes it on process
close. Cancellation and app quit stop the helper's process group, including its
yt-dlp/ffmpeg descendants. A cancelled download may leave partial files in the
chosen destination. Downloaded audio is retained if subsequent analysis fails.

Runtime tools: `brew install yt-dlp ffmpeg`. They are found in `~/.local/bin`,
`/opt/homebrew/bin`, `/usr/local/bin`, and standard system paths, including when
launched from Finder. Local audio analysis only needs ffmpeg. Global yt-dlp config
is ignored so single-video options are predictable.

Run `npm run desktop:test:native` from the repo root. BPM/key are estimates;
half/double tempo and ambiguous harmony need a musician's judgment.
