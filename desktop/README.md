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

The **YouTube Analyzer** button in the header and the **Tools → YouTube Music
Analyzer** menu open the embedded native SwiftUI app. It is built from the
sources in [`native/`](native/README.md), keeps the original interface, and can
remain open independently of the dashboard window. Repeated launches focus the
same app. Install its runtime dependencies once:

```sh
brew install yt-dlp ffmpeg
```

Paste a single YouTube URL, choose a destination (Desktop by default), and download
an MP3 with estimated BPM/key, relative major when applicable, and Show in Finder.
Audio is downloaded and analyzed on the Mac. These tools are discovered from
standard Homebrew/pip locations; they are not bundled in the installer. Swift and
Node are only needed to build, not to run the packaged app.

## Download deployment

The **Mac desktop app** GitHub Actions workflow creates downloadable artifacts
for both architectures on relevant PRs and manual runs. On the repository's
Actions page, select a completed run and download the artifact for your Mac.

For a versioned release, update `desktop/package.json`, then push a matching tag
(for example `desktop-v0.1.0`). The workflow creates a **draft** GitHub Release
with DMG/ZIP assets. Review and publish that draft to make the downloads available
from the repository's Releases page. Vercel continues deploying `main` separately.
There is no automatic app updater yet; install a newer download to upgrade.

## Signing

Local/CI builds are previews without Developer ID signing or Apple notarization.
Downloaded previews may be blocked by Gatekeeper; use macOS **Privacy & Security →
Open Anyway** only for a build you trust. Public distribution should use a
Developer ID Application certificate and notarization credentials.

The builder enables hardened runtime and microphone/JIT entitlements. For a
signed local build, provide `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` through your environment using
electron-builder's signing/notarization support. The bundled Swift app is signed
as nested code by electron-builder. CI intentionally disables identity discovery;
configure trusted release-only secrets and remove that override before enabling
signed releases. No signing credentials are committed.

## Checks and architecture

```sh
npm run desktop:test         # asset routing, CSP, trusted origins, external links
npm run desktop:test:native  # URL validation, large subprocess output, BPM/key
npm test -- --runInBand      # existing guitar tool tests
npm run build               # hosted build regression check
```

Smoke test the packaged app: launch it, use the fretboard/chord player, open the
analyzer, download a permitted recording, verify BPM/key and Finder, close/reopen
the dashboard window, and check note detection's microphone prompt. `/listen`
and `/theme` also resolve from bundled files on reload.

Electron uses a sandboxed renderer, context isolation, a CSP with hashes for the
generated Remix hydration scripts, and a single narrow preload method. IPC
accepts only the main bundled frame, and the launcher accepts no paths or command
arguments from the renderer. External HTTP(S) links open in the browser. Camera,
remote-frame microphone, and other permission requests are rejected.

References: [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol/),
[Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[electron-builder macOS](https://www.electron.build/mac/).
