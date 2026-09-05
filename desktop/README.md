# Jam Dashboard for Mac

The Electron app loads a bundled, static build of the existing Remix website at
`jam://dashboard/`. It runs without Vercel or a local HTTP server. The dashboard
tools work offline; the About video, external links, and YouTube downloads need
internet. Ads, analytics, and the PostHog feedback form are disabled in desktop
builds. `npm run build`, `npm run dev`, and Vercel deployment retain their web behavior.

## Build and install

On macOS 13 or newer with Node 22+ and Xcode command-line tools:

```sh
npm ci
npm run desktop:dev                 # build both components and open Electron
npm run desktop:package             # DMG + ZIP for this Mac's architecture
npm run desktop:package -- --arm64  # Apple Silicon
npm run desktop:package -- --x64    # Intel (also cross-buildable on Apple Silicon)
```

Output goes to `release/Jam-Dashboard-0.1.0-{arm64,x64}.{dmg,zip}`. Open the DMG
and drag **Jam Dashboard** into Applications, or unzip and copy the app there.
For code changes, rebuild with `npm run desktop:build` and restart with
`npm run desktop:start`. Swift build products and desktop renderer output are
isolated from the normal `build/` directory. No sibling repository is needed.

The **YouTube Analyzer** header button and **Tools → YouTube Music Analyzer** menu
open a collapsible side drawer inside the main window. Paste a YouTube URL to
save an MP3, or choose/drop a local audio file (MP3, WAV, M4A, FLAC and more).
The drawer shows download/analysis progress, BPM/key estimates, confidence, and
Show in Finder. Closing it leaves the job running and retains its result for
reopening; Cancel stops the helper and its downloader/decoder processes.

Click **Use [detected key]** or **Use relative major** to update the same shared
key/scale context used by the global picker, fretboard, chord explorer, ear
training, and note detector. Results do not change the selected key automatically.
Accidental/enharmonic display labels carry separate Tonal-compatible selection
values, and unknown keys cannot be applied. Job snapshots live in Electron's main
process for the current app session, surviving drawer closure and renderer reload.

Install the runtime tools once:

```sh
brew install yt-dlp ffmpeg
```

Local-file analysis requires only ffmpeg; YouTube downloads also need yt-dlp and
internet. These tools are discovered from standard Homebrew/pip locations and are
not bundled in the installer. Swift and Node are only needed to build.
A headless Swift helper built from [`native/`](native/README.md) performs local
analysis and returns structured JSON events; no separate analyzer application is
launched or included in the package. Quitting Jam Dashboard cancels an active job.
A failed analysis preserves the downloaded file and its Finder action; cancelled
downloads may leave partial files in the selected folder.

## Download deployment

The **Mac desktop app** GitHub Actions workflow creates downloadable artifacts
for both architectures on relevant PRs and manual runs. On the repository's
Actions page, select a completed run and download the artifact for your Mac.

For a versioned release, update `desktop/package.json`, then push a matching tag
(for example `desktop-v0.1.0`). The workflow creates a **draft** GitHub Release
with DMG/ZIP assets. Review and publish that draft to make the downloads available
from the repository's Releases page. Vercel continues deploying `main` separately.
There is no automatic app updater yet; install a newer download to upgrade.

## App icon

The Mac bundle and installer use the angled red guitar artwork from
`assets/JamDashboard.icns`, inspired by the website favicon. The source PNG and
generation prompt are kept in `assets/`. After replacing the artwork, regenerate
all standard Mac icon sizes with `bash desktop/build-icon.sh` and repackage.

## Signing

Local/CI builds are previews without Developer ID signing or Apple notarization.
Downloaded previews may be blocked by Gatekeeper; use macOS **Privacy & Security →
Open Anyway** only for a build you trust. Public distribution should use a
Developer ID Application certificate and notarization credentials.

The builder enables hardened runtime and microphone/JIT entitlements. For a
signed local build, provide `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` through your environment using
electron-builder's signing/notarization support. The bundled Swift helper is signed
as nested code by electron-builder. CI intentionally disables identity discovery;
configure trusted release-only secrets and remove that override before enabling
signed releases. No signing credentials are committed.

## Checks and architecture

```sh
npm run desktop:test         # job lifecycle, cancellation, IPC data, asset routing, CSP
npm run desktop:test:native  # key selection values, URL validation, BPM/key
npm test -- --runInBand      # existing guitar tool tests
npm run build               # hosted build regression check
```

Smoke test the packaged app: open the drawer, select a local recording or download
a permitted YouTube URL, click its detected key and verify the header/fretboard
change. Check a minor key's relative-major action, close/reopen the drawer, cancel
a job, and reveal a completed file. `/listen` and `/theme` reload locally too.

Electron uses a sandboxed renderer, context isolation, a CSP with hashes for
Remix hydration scripts, and narrowly scoped preload methods. IPC accepts only
the main bundled frame. Native dialogs choose paths; dropped files use Electron's
`webUtils.getPathForFile`. The helper executable is fixed and gets argument arrays
without a shell. URL, audio-file, and worker-result validation happen in the main
process. Renderer progress listeners are unsubscribed on unmount. External HTTP(S)
links open in the browser; unrelated permission requests are rejected.

References: [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol/),
[Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[electron-builder macOS](https://www.electron.build/mac/).
