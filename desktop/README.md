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
npm run desktop:package -- --arm64  # DMG + ZIP for Apple Silicon
```

Releases are Apple Silicon (arm64) only; Intel Macs are not supported.
Output goes to `release/Jam-Dashboard-0.1.0-arm64.{dmg,zip}` plus the
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

## Live Fretboard (camera tracking)

The desktop-only **Live Fretboard** tab (next to **YouTube Analyzer**) shows the
camera with the currently selected key/scale, quick colors or CAGED shapes drawn
onto the guitar's frets. Choose a camera, or **Video file…/Open video** to play a
local clip instead (useful for testing), then press **Start**. macOS asks for
camera access the first time (`NSCameraUsageDescription`; the hardened runtime
has `com.apple.security.device.camera`). Video stays on the Mac.

- The renderer letterboxes each frame to 640×640 RGBA and sends it over IPC to
  `desktop/tracker.cjs`, which keeps one frame in flight to the bundled
  `FretTrackerCLI` helper (frames that arrive while it is busy are skipped).
- The helper runs one of three bundled CoreML models, compiled from
  `native/models/FretTracker{V1,V3,V4Q832}.mlpackage` at build time, and the Swift port
  of the guitar-overlay tracker post-processing (RANSAC homography, board-end
  vote, One-Euro smoothing). It returns H, the fret count and wire endpoints in
  source pixels. See [`native/README.md`](native/README.md).
- **Tracking model** picker offers **YOLO v1 (AGPL)**, **FretNet v3 (permissive)**,
  and **v4q-832 (permissive)**. Switching restarts the helper and resets temporal
  state; the choice is remembered across launches. v1 remains the default.
  v4q-832 uses a torchvision ResNet-50/FPN with keypoint queries, an 832×832
  input, and a native robust-fit reindexing step before unletterboxing. Points
  at least 0.30 fret from the nearest fitted wire are dropped; observed positions
  are preserved. The threshold was selected on all 1,498 scale-v1aug VAL images.
  The fixed held-out result is eval-v2 numbering 0.7142, wire mean/median
  5.28/2.16 px, coverage 0.8461; 09-06 numbering 1.000, D13 0.762 px,
  coverage 0.9872. v1/v3 retain their 640×640 input and existing processing.
  v1 remains the speed-oriented default; see guitar-overlay
  `eval/refit_validation.md` for validation, conversion parity and latency.
  The permissive models use own code and BSD-3-Clause torchvision weights.
  Shipping v1 retains the app's AGPL-3.0 obligation; remove its entries from
  `electron-builder.json`, `build-helper.sh` and `main.cjs` to remove that model.
- WebGL2 draws the video and the notes from the same marker logic as the
  fretboard diagram (`app/utils/fretNoteMarkers.ts`), projected through H onto
  the cells between wires with six evenly spaced strings.
- Orientation has no control of its own (`app/components/LiveFretboard/orientation.ts`):
  - **Model input** is flipped when the page-level **Left-handed** setting is on.
    The tracker needs a right-handed view (guitar-overlay D1), and cameras and
    video files deliver unmirrored pixels, so a lefty is exactly the frame that
    needs flipping.
  - **Display** is mirrored (selfie view) for live cameras, unless the camera
    reports `facingMode: "environment"` (faces away from you). Video files are
    shown as recorded. The tracker answers in source pixels, so the overlay
    follows the display either way.
  - Not handled: a recording that was itself saved mirrored (e.g. by a selfie
    camera app). It plays as recorded and is tracked as a guitar of the other
    handedness.
- **Full screen** (button at the top right of the video) shows only the video
  and overlay; leave with **Esc** or the same button.

End-to-end check (macOS, after `npm run desktop:build`; pass `--app` to test a
packaged build):

```sh
node desktop/e2e/live-fretboard.mjs --video clip.mp4 --out /tmp/live-fretboard \
  [--app "release/mac-arm64/Jam Dashboard.app"] [--models v3,v1] [--lefty]
```

## AI agent connection

Open Agent chat and choose **MCP connection** to connect Codex, Cursor or another MCP client. The bundled service listens at `http://127.0.0.1:4177/mcp`; the panel provides its private bearer token. Agents can select scales/CAGED coloring, identify chords, show/select basic chord voicings, and analyze songs. The installed app needs no separate Node service. See the [agent setup guide](../docs/agent-tools.md).

For a song's key and BPM, an agent calls `analyze_song` with a song name and artist or a direct YouTube URL, then polls `get_song_analysis` every few seconds using the returned job ID. Read the current job before retrying an uncertain start. In an open dashboard window, the analyzer tab is selected automatically and shows the same search, download, and analysis progress as a manual start. Song searches use the first YouTube match, and MP3s save to the existing destination. The agent sees matched video metadata and BPM/key estimates with confidence; snapshots omit destination and file-path fields. Analysis does not apply the key automatically, but a follow-up `set_view` can use its `analysis.keyScale` when requested.

One job runs at a time across human and agent requests. `cancel_song_analysis` requires the exact job ID, so an old request cannot stop a newer job. The current job and up to eight recent terminal snapshots survive renderer reloads but are cleared when the app restarts. These tools do not require a connected fretboard view or selected scale. The standalone Chrome host and native WebMCP report analysis as unavailable; use this desktop endpoint for songs. The AI guide's Advanced mode documents the exact tools and schemas.

## Agent chat and voice (your AI Gateway key)

The round **Agent chat** button works in the installed app without Vercel hosting.
Chat and voice requests go to `jam://dashboard/api/agent-chat` and
`/api/agent-transcribe`, which the Electron main process serves with the same
handlers as the website. Tool calls go to the app's local MCP service on
`127.0.0.1:4177`. The renderer's CSP stays `connect-src 'self'`; it never talks
to the AI Gateway or MCP directly. These routes require an
`X-Jam-Agent-Request` header, so other origins (such as the embedded YouTube
player) can't call them without a CORS preflight, which the `jam:` scheme never grants.

Each person uses **their own Vercel AI Gateway key**, stored in their macOS
Keychain:

| Keychain field    | Value                          |
| ----------------- | ------------------------------ |
| Service ("Where") | `Jam Dashboard`                |
| Account           | `AI_GATEWAY_API_KEY`           |
| Name (label)      | `Jam Dashboard AI Gateway key` |

The key is **not** in the DMG, the ZIP, CI, or any JavaScript bundle. The main
process reads it from Keychain for each request and gives it to the AI Gateway
client directly. It is never put in `process.env` (so helper processes don't
inherit it) and never sent to the renderer. `desktop/build.mjs` strips
`AI_GATEWAY_API_KEY`/`VERCEL_OIDC_TOKEN` from build steps and refuses to package
if the renderer or bundled main-process files contain a Gateway key.

### Adding, replacing, or removing the key

1. Open **Agent chat**. Without a key it shows **Add your AI Gateway key** with
   these steps instead of the chat.
2. Paste the key (it usually starts with `vck_`) and click **Save**. Jam
   Dashboard writes it to Keychain via `/usr/bin/security` (the key is passed
   on stdin, not as a command-line argument) and reads it back to confirm.
3. To rotate it later, click the key button in the Agent chat header, paste the
   new key, and click **Replace**. **Remove key from Keychain** deletes it. If
   the Gateway rejects a key, the chat error shows a **Replace key** button.

You can also inspect or delete the item in **Keychain Access** (search for
"Jam Dashboard"), or add it from Terminal (it prompts for the key):

```sh
security add-generic-password -U -s "Jam Dashboard" -a AI_GATEWAY_API_KEY -w
```

An item created outside the app may make macOS ask once whether `security`
may read it; choose **Always Allow**.

In development (`npm run desktop:start`), `AI_GATEWAY_API_KEY` in the shell
environment overrides Keychain. Packaged apps use Keychain first and fall back
to that environment variable only when no Keychain item exists.
`JAM_AGENT_CHAT_MODEL` and `JAM_AGENT_TRANSCRIBE_MODEL` work as they do on the web.

### Giving friends access (until user accounts exist)

For now, Chase gives each friend their own key rather than sharing one:

1. In the Vercel dashboard, open **AI Gateway → API Keys** and click **Create
   key**. Name it after the friend (for example `jam-dashboard-alex`).
2. Send the key privately (not in a public channel or the repo). The friend
   installs the DMG and pastes it into **Agent chat** once.
3. Keep an eye on usage and spend in the AI Gateway dashboard. To cut someone
   off, revoke their key; everyone else keeps working. To rotate, create a new
   key and have them click **Replace**.

This is an interim setup. Once Jam Dashboard has user accounts, a hosted
service can hand out credentials instead of per-friend keys.

## Releases and automatic updates

The **Mac desktop app** GitHub Actions workflow (`.github/workflows/desktop.yml`):

- **Pull requests / manual runs on other branches** build unsigned preview
  artifact (`Jam-Dashboard-mac-arm64`) on the run's Actions page. These jobs
  never receive signing secrets.
- **Every merge to `main`** (or a manual run on `main`) publishes a GitHub
  Release `desktop-v<version>` with the arm64 DMG, ZIP, their blockmaps, and
  the `latest-mac.yml` update feed.

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
same workflow signs, notarizes, staples, and verifies the app before publishing.

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

Notarization runs in `desktop/notarize.cjs` (an electron-builder `afterSign`
hook) instead of electron-builder's built-in `notarytool submit --wait`, which
has hung in CI after Apple accepted the submission. The hook logs the submission
ID, polls `notarytool info` every 30 seconds, and fails the build on `Invalid`,
`Rejected`, or after `JAM_NOTARIZE_TIMEOUT_MINUTES` (default 20), printing
Apple's log. If a build times out, check the logged ID with
`xcrun notarytool info <id>`.

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

**Hand cutout** (default off), beside the tracking model picker, reveals hands
above the overlay. Vision fast, Vision balanced, and a skin-color baseline run
natively with any tracking model. The selected method defaults to Skin color
(baseline) (`skin`); saved method choices are preserved. The checkbox and selected option are stored
independently in localStorage (`jam-live-fretboard-hand-cutout` and
`jam-live-fretboard-hand-option`). Fast prioritizes latency; balanced gives finer
edges. Person segmentation restricted to hand boxes can still erase guitar
pixels, and missed hand detections can flicker. No hand inference runs when off.
The live stats report added hand time and any Vision error.

For native screenshot verification:

```sh
node desktop/e2e/live-fretboard.mjs --video clip.mp4 --out out/hands/e2e \
  --models v4q832,v3,v1 --hand-cutout vision-fast --seek-seconds 30 --lefty
```

`--lefty` must match the recorded orientation (09-06 needs it). The e2e also toggles
hand cutout off/on, verifies zero native work while off, and checks persistence.

## Live Fretboard recordings

With a camera running, **Record** beside the model picker records locally. Stop
recording (or stop/change the camera) to finalize it. Edit the recording note
while recording or after stopping; **Show in Finder** reveals the saved sidecar.
Recording is hidden on the web and disabled for file playback. Files live under
Electron's user Videos directory (normally `~/Movies` on macOS), in
`Jam Dashboard Recordings/YYYY-MM-DD_HH-MM-SS_<model-id>_<unique-suffix>/`.
The timestamp is UTC; the suffix prevents same-second collisions.

- `raw.webm`: VP8 camera stream, before any display mirror, with no audio.
- `overlay.webm`: VP8 capture of the actual WebGL canvas, including the camera,
  note patches, labels, fitted wires, and hand occlusion at the selected opacity.
- `session.json`: schema below. Built from streamed frames on stop, without
  loading the full recording into memory; note edits replace it atomically.
- `note.txt`: UTF-8 note, also stored in `session.json.note`.
- `frames.jsonl` and `settingChanges.jsonl`: append-only frame and settings-change
  journals, retained for recovery if the app terminates before finalization. An
  interrupted WebM may be incomplete.

### Sidecar schema (version 2)

Top-level fields: `schemaVersion`, main-process `appVersion`, ISO `startedAt`,
`performanceStart` (renderer monotonic milliseconds), `folderName`, `mimeType`,
initial `model`, `leftHanded`, `mirrored`, `handCutout` (`enabled`, `option`,
`opacity` in 0–1), raw video `width`/`height`, `note`, `error` (recording failure or null),
`settings` (independent initial snapshot), `settingChanges` (ordered array, empty
when nothing changed), and `frames` (ordered array). The legacy top-level setting
fields remain initial values for compatibility. The folder's model is the initial
model; it may change during recording.

`settings` and each frame's `settings` contain:

- `model`: tracker model id; `leftHanded`: model-input handedness;
  `mirrored`: actual display mirror; `handCutout`: `enabled`, `option` (method id),
  and `opacity` (0–1, including when disabled).
- `width`/`height`: decoded raw-video pixel dimensions; `source`: selected camera
  device id (`""` means default camera, `"file"` means file playback);
  `fullscreen`: presentation state.
- `camera.deviceId` and `camera.label`: active video track identity, null when
  unavailable. `camera.requested` stores the exact video constraints passed to
  `getUserMedia` (currently ideal 1280 × 720 at 30 fps and, if selected, exact
  device id). `camera.actual` contains `width`, `height`, and `frameRate` from
  `MediaStreamTrack.getSettings()`; unsupported values are null, never invented
  from requested values. Frame rate is in frames per second.
- `overlay`: `key`, `scale`, `notes`, `pentatonicNotes`, `highlightedNotes` (note
  and color pairs), `rootNotes` (ordered string tuning), and the full agent
  `display` selection (including optional exact positions). `options` contains
  all shared settings: `isLefty`, `numberOfFrets`, `numberOfStrings`,
  `showTextNotes`, `quickColors`, `cagedModeEnabled`, `cagedShape`,
  `showMajorMinorScales`, `showHarmonicMelodicScales`, and `showModes`.
  `fretRange` records the live overlay's effective marker range (`from: 1`,
  `to: 24`), which is independent of the diagram's fret-count preference.
  Exact rendered geometry and resolved theme colors remain in each frame.

Every `settingChanges` entry is `{t_ms, key, from, to}`. `t_ms` is
`performance.now() - performanceStart`, the same clock as frame `t_ms` (not
wall time or camera media time). `key` is a dotted path relative to `settings`,
for example `handCutout.opacity`, `overlay.key`, or `camera.actual.frameRate`.
Nested objects are diffed by field; arrays are replaced as a whole. Missing
optional fields use null in changes. Apply entries in order to a copy of the
initial snapshot; multiple changes can share a timestamp. Identical snapshots
do not emit changes. Committed UI changes are observed even without a new video
frame; actual track settings are also sampled on each draw.

Changing the camera/source still finalizes the current recording. The final
`source` change records the newly selected device id before closing, while
`camera` describes the track actually recorded. A new recording snapshots the
new camera's resolved identity and actual format. This avoids implying that the
old raw video contains frames from the newly selected camera. Changes are streamed
through main-process IPC and assembled into `session.json` on stop, including
changes after the last frame; editing a saved note preserves both arrays.

Each frame describes one displayed canvas draw, including draws reusing an older
inference result. Fields:

- `frameIndex`: zero-based draw index; `t_ms`: draw time minus `performanceStart`.
  Both encoders start on this same `performance.now()` clock. `encoderStart_ms`
  records their individual `raw` and `overlay` start-call offsets, so subtract the
  relevant offset from `t_ms` when aligning to the corresponding encoded video.
  MediaRecorder does not guarantee identical first-frame presentation times;
  these are monotonic start-call timestamps, not container PTS values.
- `mediaTime`: camera frame time in seconds from `requestVideoFrameCallback`, or
  null with the animation-frame fallback. `inferenceCapturedAt` is the input
  capture's relative monotonic milliseconds; `inferenceMediaTime` identifies its
  camera frame. These differ from draw time due to asynchronous inference.
- `settings`: full current snapshot described above on every draw. Use the
  top-level `settingChanges` journal for transitions between draws as well.
- `keypoints`: flattened 50 × `(x, y, confidence)` array, slots `0 bass`,
  `0 treble`, …, `24 treble`; nonfinite entries are null. Coordinates are raw,
  **unmirrored** video pixels, with integer pixel centers and top-left origin.
  Null means the helper supplied no keypoints. `confidence` is the board score.
- `tracking`: validated tracker result, including `H` (row-major canonical board
  to unmirrored source pixels), `tau`, `nFrets`, fitted `wires`, anchor count,
  held/valid state, RMSE and timings; null before the first result. The tracker
  reverses its left-handed model-input flip before returning these coordinates.
- `overlay`: the **exact geometry passed to the renderer**, in display pixels:
  colored cell quads, fitted wire/string endpoints, and labels with text, center,
  and size. Empty geometry means nothing was drawn, even if a stale result exists.
  `colors` stores the renderer's cached RGBA theme colors. Renderer styling is
  defined by `app/components/LiveFretboard/overlayRenderer.ts`: cells alpha .82,
  strings white alpha .35, wires `[.95,.95,.85,.6]`, labels `[.06,.06,.08,1]`.
- `mask`: the exact applied hand mask (`width`, `height`, base64 row-major uint8
  `alpha`), or null, including when a stale mask was suppressed. `maskTransform`
  maps display UV to model-letterboxed mask UV as `[scaleX,scaleY,offsetX,offsetY]`.
  The overlay alpha multiplier is `1 - handCutout.opacity * maskAlpha`.

To reproduce the displayed output, mirror raw video if that frame's
`settings.mirrored` is true, then render the stored display-space geometry and
mask. Do not mirror `overlay` again. To put the geometry on an unmirrored raw
frame instead, transform every display x as `width - 1 - x` when mirrored;
likewise compose the inverse horizontal flip into the mask UV transform.
`tracking.H`, `tracking.wires`, and `keypoints` are already in raw coordinates.
Use stored geometry for replay rather than recomputing from current scale or
color settings. Source frames and inference timestamps are both retained because
tracking may lag the displayed camera image.

All recording writes and Finder access go through the existing trusted-main-frame
IPC gate and isolated preload. Renderer requests contain opaque session IDs,
fixed stream names, and bounded chunks, never filesystem paths. MediaRecorder
emits one-second chunks. A bounded renderer queue stops recording with an error
if disk writes fall behind, rather than retaining an entire session in memory.
