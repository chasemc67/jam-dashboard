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
npm run test       # run unit tests
npm run storybook  # storybooks
npm run format     # prettier
```

## Deployment

Changes merged to main will auto-deploy to vercel

### Mac desktop app

Jam Dashboard also packages as an Electron Mac app, with a **YouTube Analyzer**
button that opens the bundled native downloader and BPM/key analyzer.

```sh
npm run desktop:dev      # build and launch on macOS
npm run desktop:package  # create DMG and ZIP in release/
```

See [desktop setup and downloads](desktop/README.md) for requirements, Apple
Silicon/Intel builds, GitHub release artifacts, and signing. The hosted website
keeps its existing build and does not expose local downloader functionality.


## About

See the [.cursorrules](./.cursorrules) file for an in-depth description of where to find things and how they're built
