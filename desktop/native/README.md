# Bundled YouTube Music Analyzer

Imported from `YouTubeMusicAnalyzer` commit
`e7acc4c62e5b11801e9a67ef510827bee5b797ad` on September 4, 2026.
These sources belong to Jam Dashboard now; building does not require the sibling
repository or a separately installed analyzer. The original repository is unchanged.

The SwiftUI window preserves the original downloader, destination picker, MP3
metadata/thumbnail, BPM/key analysis, relative major, and Show in Finder action.
`MusicCore` remains separate from the UI so a later Electron UI can reuse it through
a small command-line/IPC interface. Currently the only Electron bridge operation
opens this fixed bundled app. Results are displayed in its window, not transferred
to the dashboard's key picker.

Integration changes: a distinct bundle ID, architecture-aware build, file-backed
subprocess output to avoid full-pipe deadlocks, and ignoring global yt-dlp config
so the app's single-video download options are predictable.

Requirements at runtime: macOS 13+, `yt-dlp` and `ffmpeg` on the user's Mac.
Install with `brew install yt-dlp ffmpeg`. Tools are found in `~/.local/bin`,
`/opt/homebrew/bin`, `/usr/local/bin`, and standard system paths, including when
launched from Finder. Downloading requires internet; analysis runs locally.

Run `npm run desktop:test:native` from the repository root. The CLI can analyze
a local recording with `swift run MusicAnalyzerCLI /path/to/song.mp3` here.
BPM/key are estimates; half/double tempo and ambiguous harmony need a musician's
judgment. Only download audio you have permission to save and use.
