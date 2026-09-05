# AGENTS.md

## Cursor Cloud specific instructions

Jam Dashboard is a single-service Remix (React + Vite) frontend app for guitar/music-theory tooling (fretboard visualizer, ear-training game, chord explorer). There is no backend service, database, or external dependency required to run it locally — it runs entirely in the browser dev server.

- Package manager is npm (`package-lock.json`). Node 20+ is required (the VM has a newer Node, which works fine). Dependencies are installed by the startup update script, so you normally don't need to run `npm install` yourself.
- Standard commands live in `package.json` and `README.md`; use those rather than duplicating them. Key ones: `npm run dev` (dev server on http://localhost:5173), `npm test` (Jest), `npm run lint` (ESLint), `npm run typecheck` (tsc), `npm run storybook` (Storybook on port 6006), `npm run build` (production build).
- `npm run lint` currently reports a handful of pre-existing errors/warnings in committed code (e.g. `app/components/Sidebar/Sidebar.tsx`, `app/components/ui/command.tsx`, `stories/Button.tsx`). These are not caused by environment setup — do not "fix" them as part of unrelated work.
- Audio features (chord/note playback) use the Web Audio API via Tone.js and only produce sound in a real browser with user interaction; there is no audio device in the headless VM, but the UI and fretboard visualization still work and are the best target for automated verification.
- The chord explorer's "play" affordance is a small speaker icon; selecting a root note then a chord quality (e.g. `G` then `Gmaj`) updates the fretboard to highlight that chord's notes.
