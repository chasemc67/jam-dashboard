# Local song analysis helper

`MusicCore` and the original CLI were imported from `YouTubeMusicAnalyzer` commit
`e7acc4c62e5b11801e9a67ef510827bee5b797ad`. The original repository is unchanged.
Jam Dashboard now owns this copy; building does not require the sibling repo.

Only the headless `MusicAnalyzerCLI` is packaged. Its Swift code downloads and
converts audio with yt-dlp/ffmpeg and estimates BPM/key locally. The UI lives in
Jam Dashboard's React tab; no separate SwiftUI app is built or launched.

## Protocol

The helper writes one JSON event per stdout line (progress, downloaded file,
result, or error). The Electron main process validates these events and owns a
single job, retained snapshot, cancellation, and timeout. The typed renderer
contract lives in `app/types/analyzer.ts`.

```sh
MusicAnalyzerCLI --json download 'https://youtu.be/VIDEO_ID' /path/to/destination
MusicAnalyzerCLI --json search-download 'Artist — Song title' /path/to/destination
MusicAnalyzerCLI --json analyze /path/to/song.mp3
MusicAnalyzerCLI /path/to/song.mp3  # human-readable output for development
```

Song queries use yt-dlp's YouTube search and automatically download its first
match. Adding the artist makes the match more specific. Search uses metadata
only, then passes the resolved video URL through the existing download and
analysis pipeline. The helper emits `searching`, a `source` event with the
matched title, canonical YouTube URL, channel and duration (when available),
then `downloading` and `analyzing`. No API key or additional dependency is needed.
`YouTubeSearch.search` also supports up to five results for future selection UIs.

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

## Fretboard tracker helper (`FretTrackerCLI`)

`FretCore` is a pure-Swift port of the guitar-overlay `gro` post-processing (letterbox/decode, RANSAC + Huber
homography fit, board-end ridge test + fret-count vote, One-Euro smoothing, tracker state machine).
`FretTrackerCLI` runs `dist/FretTrackerV1.mlmodelc` (compiled from `models/FretTrackerV1.mlpackage` by
`scripts/build-helper.sh`) and speaks a binary-in / JSON-lines-out protocol on stdin/stdout:

```sh
FretTrackerCLI --model dist/FretTrackerV1.mlmodelc [--compute-units all|cpuAndNeuralEngine|cpuAndGPU|cpuOnly] [--frets N]
FretTrackerCLI --bench 200 --model dist/FretTrackerV1.mlmodelc   # one {"type":"bench"} line, median/p95 ms
```

Each frame on stdin is a 32-byte little-endian header (`"FRT1"`, u32 frameId, f64 t, u32 srcWidth, u32 srcHeight,
u32 flags: bit0 mirrored / bit1 reset, u32 payloadBytes = 640*640*4) followed by the 640x640 RGBA8 letterboxed
canonical frame. The helper prints `{"type":"ready",...}` once, then one `{"type":"frame",...}` line per frame
(H, wires, nFrets, ... in original-frame px; non-finite numbers are null). `--emit-kpts` adds the raw keypoints
(debug / parity). The board-end ridge test samples the 640 letterbox instead of the full-resolution frame.

Parity against the Python tracker: `scripts/fret_parity.py` (Mac, needs gro + coremltools). Test fixtures:
`scripts/fret_fixtures.py` regenerates `Tests/FretCoreTests/Fixtures/gro_reference.json`.
