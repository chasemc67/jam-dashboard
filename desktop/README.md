# Jam Dashboard for Mac

The Electron app loads a bundled, static build of the existing Remix website at
`jam://dashboard/`. It serves the renderer without Vercel or a local web server; its optional agent connection uses a bundled loopback MCP service. The dashboard
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
npm run desktop:package -- --arm64 --x64  # both, with one combined update feed
```

Output goes to `release/Jam-Dashboard-0.1.0-{arm64,x64}.{dmg,zip}` plus the
`latest-mac.yml` update feed. Set `JAM_DESKTOP_VERSION=0.1.99` to stamp a
different version into the app and file names. Open the DMG
and drag **Jam Dashboard** into Applications, or unzip and copy the app there.
For code changes, rebuild with `npm run desktop:build` and restart with
`npm run desktop:start`. Swift build products and desktop renderer output are
isolated from the normal `build/` directory. No sibling repository is needed.

The desktop-only **YouTube Analyzer** tab sits beside **Chord Explorer**, **Ear
Training**, and **Note Detect**. It is omitted from the hosted web build. Enter a song
name (ideally with the artist) or paste a YouTube URL to save an MP3, or choose/drop
a local audio file (MP3, WAV, M4A, FLAC and more). Song names use yt-dlp's first
YouTube search match, then download and analyze that video automatically; no API
key or additional service is needed. The matched title, channel, duration, and
YouTube link stay visible. Use an exact URL when you want a specific recording.
The tab shows search/download/analysis progress, BPM/key estimates, confidence, and
Show in Finder. Switching tools leaves the job running and retains its input/result for
returning to the tab; Cancel stops the helper and its downloader/decoder processes.

Click **Use [detected key]** or **Use relative major** to update the same shared
key/scale context used by the global picker, fretboard, chord explorer, ear
training, and note detector. Results do not change the selected key automatically.
Accidental/enharmonic display labels carry separate Tonal-compatible selection
values, and unknown keys cannot be applied. Job snapshots live in Electron's main
process for the current app session, surviving tab switching and renderer reload.

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

## AI agent connection

Open **AI connection** below the fretboard to connect Codex, Cursor or another MCP client. The bundled service listens at `http://127.0.0.1:4177/mcp`; the panel provides its private bearer token. Agents can select scales/CAGED coloring, identify chords, show/select basic chord voicings, and analyze songs. The installed app needs no separate Node service. See the [agent setup guide](../docs/agent-tools.md).

For a song's key and BPM, an agent calls `analyze_song` with a song name and artist or a direct YouTube URL, then polls `get_song_analysis` every few seconds using the returned job ID. Read the current job before retrying an uncertain start. In an open dashboard window, the analyzer tab is selected automatically and shows the same search, download, and analysis progress as a manual start. Song searches use the first YouTube match, and MP3s save to the existing destination. The agent sees matched video metadata and BPM/key estimates with confidence; snapshots omit destination and file-path fields. Analysis does not apply the key automatically, but a follow-up `set_view` can use its `analysis.keyScale` when requested.

One job runs at a time across human and agent requests. `cancel_song_analysis` requires the exact job ID, so an old request cannot stop a newer job. The current job and up to eight recent terminal snapshots survive renderer reloads but are cleared when the app restarts. These tools do not require a connected fretboard view or selected scale. The standalone Chrome host and native WebMCP report analysis as unavailable; use this desktop endpoint for songs. The AI guide's Advanced mode documents the exact tools and schemas.

## Releases and automatic updates

The **Mac desktop app** GitHub Actions workflow (`.github/workflows/desktop.yml`):

- **Pull requests / manual runs on other branches** build unsigned preview
  artifacts (`Jam-Dashboard-mac-arm64`, `Jam-Dashboard-mac-x64`) on the run's
  Actions page. These jobs never receive signing secrets.
- **Every merge to `main`** (or a manual run on `main`) publishes a GitHub
  Release `desktop-v<version>` with both DMGs, both ZIPs, their blockmaps, and
  `latest-mac.yml`. Both architectures come from one electron-builder run, so
  the single feed lists both update ZIPs.

The version is `<major>.<minor>` from `desktop/package.json` plus the workflow
run number (for example `0.1.57`), so each release is newer than the last
without committing version bumps. Bump the minor or major version in
`desktop/package.json` for a visible jump (its patch number is ignored in CI). If the
workflow file is ever renamed, its run numbers restart, so bump the minor
version at the same time. Vercel continues deploying `main` separately; no
signing credentials go to Vercel.

The app uses [electron-updater](https://www.electron.build/auto-update) with the
GitHub provider. The packaged app checks 10 seconds after launch and then every
4 hours; **Jam Dashboard → Check for Updates…** checks immediately and reports the
result. Only the ZIP is used for updates; the DMG is for first installs.

- **Developer ID signed builds** download updates in the background and ask to
  restart. Choosing **Later** installs the update when you next quit.
- **Unsigned or ad-hoc builds** cannot be updated by macOS's updater, which
  requires the same Developer ID signature. When a newer release exists, they
  show a dialog linking to the Releases page instead.
- Offline or before any release exists, background checks fail quietly; menu
  checks explain what happened. Logs are written to
  `~/Library/Logs/Jam Dashboard/updater.log`. Development runs (`desktop:start`)
  skip update checks.

Keep the same Developer ID certificate (team) for every signed release; a build
signed by a different team cannot update an installed copy.

## App icon

The Mac bundle and installer use the angled red guitar artwork from
`assets/JamDashboard.icns`, inspired by the website favicon. The source PNG and
generation prompt are kept in `assets/`. After replacing the artwork, regenerate
all standard Mac icon sizes with `bash desktop/build-icon.sh` and repackage.

## Signing and notarization

Distribution is direct (Developer ID + notarization), not the Mac App Store.
Until the secrets below exist, `main` publishes **unsigned** releases: CI logs a
warning, the release notes say so, and Gatekeeper may require **Privacy &
Security → Open Anyway** (only for a build you trust). Once the secrets exist, the
same workflow signs, notarizes, staples, and verifies both apps before publishing.

The builder enables hardened runtime and microphone/JIT entitlements. The bundled
Swift helper is signed as nested code by electron-builder.

### GitHub secrets

Create an environment named `desktop-release` (**Settings → Environments**),
limit its deployment branches to `main`, and add these as environment secrets.
Repository secrets also work, but environment secrets are unavailable to other
branches even if a workflow is edited. Only the `release-build` job references them;
pull request jobs (including forks) never do.

| Secret             | Value                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`         | Base64 of a **Developer ID Application** certificate + private key exported as `.p12` (`base64 -i DeveloperID.p12 \| pbcopy`) |
| `CSC_KEY_PASSWORD` | The `.p12` export password                                                                                                    |

Plus one notarization option (the API key is preferred if both are set):

| Secret             | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| `APPLE_API_KEY_P8` | Contents of the App Store Connect API key `AuthKey_XXXXXXXXXX.p8` (raw or base64) |
| `APPLE_API_KEY_ID` | Its key ID (`XXXXXXXXXX`)                                                         |
| `APPLE_API_ISSUER` | The issuer ID from App Store Connect → Users and Access → Integrations            |

or

| Secret                        | Value                                           |
| ----------------------------- | ----------------------------------------------- |
| `APPLE_ID`                    | Apple Developer account email                   |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password from account.apple.com |
| `APPLE_TEAM_ID`               | 10-character Team ID                            |

Credentials must be complete: a partial notarization set, a certificate without
notarization, or notarization without a certificate fails the build instead of
shipping a half-signed app. After signed releases work, set the repository (or
environment) **variable** `DESKTOP_REQUIRE_SIGNING=true` so a missing secret
fails CI rather than publishing an unsigned update.

For a signed local build, export the same variables (`APPLE_API_KEY` is the
`.p8` file path locally) and run `npm run desktop:package`. Check a result with
`node desktop/verify-release.mjs --version <version> --signed true`. No signing
credentials are committed.

## Checks and architecture

```sh
npm run desktop:test         # job lifecycle, IPC data, asset routing, CSP, updater
npm run desktop:test:native  # key selection values, URL validation, BPM/key
npm test -- --runInBand      # existing guitar tool tests
npm run build               # hosted build regression check
```

Smoke test the packaged app: open the analyzer tab, select a local recording or download
a permitted YouTube URL, click its detected key and verify the header/fretboard
change. Check a minor key's relative-major action, close/reopen the analyzer tab, cancel
a job, and reveal a completed file. `/listen` and `/theme` reload locally too.

Electron uses a sandboxed renderer, context isolation, a CSP with hashes for
Remix hydration scripts, and narrowly scoped preload methods. IPC accepts only
the main bundled frame. Native dialogs choose paths; dropped files use Electron's
`webUtils.getPathForFile`. The helper executable is fixed and gets argument arrays
without a shell. URL, audio-file, and worker-result validation happen in the main
process. Analyzer progress listeners are unsubscribed on unmount. External HTTP(S)
links open in the browser; unrelated permission requests are rejected.

References: [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol/),
[Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[electron-builder macOS](https://www.electron.build/mac/).
