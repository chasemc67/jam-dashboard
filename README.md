# [Jam Dashboard](https://www.jamdashboard.com)

Jam dashboard is a simply highly-configurable tooling for guitar players.

It includes:

- Fretboard note visualizer supporting arbitrary tunings and number of strings
- Ear training tests including individual notes and different chord types
- Chord explorer which includes a quick way to hear different chords, and to visualize voicings on the fretboard

![Screenshot 2025-01-29 at 12 40 47 PM](https://github.com/user-attachments/assets/83cf4e61-c87c-4ce8-9c86-3af001230fb6)

## Development

Common commands:

```shellscript
npm run dev        # dev server
npm run agent:dev  # web app + local MCP (in-app Agent chat)
npm run test       # run unit tests
npm run storybook  # storybooks
npm run format     # prettier
```

### In-app Agent chat

The round **Chat** button (next to **AI**) talks to the local Jam MCP server through the Vercel AI SDK.

1. Copy `.env.example` to `.env` and set `AI_GATEWAY_API_KEY`.
2. Run `npm run agent:dev` and open `http://127.0.0.1:5173`.
3. Click **Chat** and ask something like “Show B major on the fretboard.”
4. Optional voice input, with two modes picked by the **Dictation | Jev** switch:
   - **Dictation:** click the mic, speak, and the words stream into the message
     box. Stopping the mic keeps the draft; press **Send** to send.
   - **Jev:** click the mic once and leave it on. Everything is transcribed, and
     [Jev](skills/README.md) (`typesafe-ai/jev` via AI Gateway) sends only the
     speech meant for the assistant as chat messages; TV, side conversations and
     other ambient speech are held. The scroll icon in the chat header (or
     **Transcript** while listening) opens the full session transcript with sent
     parts highlighted, so a missed request can be copied or added to the message box.

   Pick a **Chat microphone** independently of Note Detector — the chat device is
   stored as `jam-agent-chat-voice-device-id`. Using two different physical mics at
   once is supported; opening the same device twice is often flaky in browsers.

`npm run agent:dev` prints the MCP URL and starts the same-origin `/__jam-agent/config` endpoint the app already uses for AI connection. Do not commit gateway keys or MCP tokens.

In the Mac app, each user pastes their own AI Gateway key into Agent chat and it is
stored in their macOS Keychain (service `Jam Dashboard`, account `AI_GATEWAY_API_KEY`);
no key ships in the DMG. See [desktop/README.md](desktop/README.md#agent-chat-and-voice-your-ai-gateway-key).

## Deployment

Changes merged to main will auto-deploy to vercel

### Mac desktop app

Jam Dashboard also packages as an Electron Mac app, with a desktop-only **YouTube Analyzer**
tab beside Chord Explorer, Ear Training, and Note Detect. Click a detected key or its
relative major to set the dashboard key; downloads and analysis run locally.

```sh
npm run desktop:dev      # build and launch on macOS
npm run desktop:package  # create DMG and ZIP in release/
```

Every merge to main also publishes a Mac release on
[GitHub Releases](https://github.com/chasemc67/jam-dashboard/releases), which
installed apps use to update themselves. See
[desktop setup and downloads](desktop/README.md) for requirements, Apple
Silicon builds, automatic updates, and the signing/notarization secrets. The
hosted website keeps its existing build and does not expose local downloader
functionality.

## About

See the [.cursorrules](./.cursorrules) file for an in-depth description of where to find things and how they're built
