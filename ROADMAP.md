# Jam Dashboard roadmap

Jam Dashboard started as a web fretboard visualizer, ear trainer, and chord explorer. The next version is a **local, modular practice dashboard** whose primary UI is a live camera overlay locked to a real guitar neck. The current Remix app remains useful as a 2D reference view and as a source of music-theory behavior, but camera + hardware work will live in Python so we can use the user's webcam, mic, and GPU.

This file is the long-term plan. We are building it in short iterations. **The current iteration is only the live fretboard overlay.**

## North star

A desktop dashboard that:

- Shows a camera feed of the player's guitar with a perspective-correct overlay on the neck
- Offers several visualization modes (full scale, pentatonic, chord tones, CAGED shapes, arbitrary custom cells)
- Can also show the existing 2D fretboard, chord grid, and other panels as modules around the camera
- Lets the player trigger actions that change what is drawn (key, scale, chord, overlay style)
- Later, drives those same actions with voice and an AI agent that has tools

Think of the reference recording: camera in the center, HUD around it, a flat neck diagram, mode toggles, and overlays that mean "play these cells." Our first slice is the hard part of that picture — **detect the neck and stick markers to it.**

## Iteration 1 — Live fretboard overlay (current)

**Goal:** Prove we can find a guitar neck in video and paint *something* on it.

In scope:

- Python app that reads a webcam or video file
- Detect the neck without training a custom model (YOLO-World / COCO YOLO + geometry)
- Track the neck as it moves
- Overlay a grid and numbered markers on arbitrary `(string, fret)` cells
- Manual four-corner fallback if auto-detect fails (`--corners`, same idea as `capture-ref`)

Out of scope for this iteration:

- Real scales, chords, or the existing TypeScript theory code
- Voice / AI agent
- Hand tracking
- The modular dashboard chrome
- Training our own detector

Code: [`fretboard_cam/`](./fretboard_cam).

### Do we need to train a model?

Not for this demo. YOLO-World is an open-vocabulary detector we prompt with `"guitar neck"` / `"guitar fretboard"`. If that is too loose on real practice-cam footage, options in order:

1. Keep using `--corners` / a one-time click calibration and optical flow (already implemented)
2. Try COCO YOLO's `guitar` class and tighten the quad with line detection
3. Only then collect a small labeled set and fine-tune YOLO-OBB on fretboards

If we do get to (3), we will need a short video of *your* guitar from the camera angle you actually practice with. A downloaded YouTube clip is enough to develop against; your own clip is what we would train on.

## Iteration 2 — Overlay that means something

Reuse the music-theory ideas from the current web app, reimplemented in Python (or called via a small shared layer):

- Key / scale picker drives which cells light up
- Modes: all scale tones, pentatonic only, chord tones, CAGED box
- Colors matched to the existing note-color language
- HUD label on the neck (`G mixolydian`, `D pentatonic`, etc.)

The web 2D fretboard can stay as a second view of the same state.

## Iteration 3 — Modular dashboard

A local UI (likely still Python for the camera process, with a webview or a thin desktop shell) that can show several panels:

- Live overlay (primary)
- Flat 24-fret diagram (as in the reference recording)
- Chord list / voicing panel
- Settings: tuning, visible frets, overlay alpha, lefty, number of strings

Panels are modules. Visualization config is a single state object that any panel or action can change.

## Iteration 4 — Actions, then voice + AI

Treat overlay changes as **tools**, not one-off UI handlers:

- `set_key_scale(key, scale)`
- `set_mode(scale|pentatonic|chord|caged|custom)`
- `highlight_chord(name)`
- `set_visible_frets(n)` / `set_alpha(x)`
- `clear_overlay()`

Keyboard and GUI fire those tools first. Then an AI agent (mic → speech-to-text → LLM with tool calls) can say "show me the G minor pentatonic box" and hit the same tools. Voice is a later layer; it should not be baked into the renderer.

## Later

- Hand / fingertip tracking (`M hands` in the reference HUD)
- Pitch detection from the local audio interface, driving a "you are here" marker (we already have a web pitch detector to learn from)
- Ghost / tablature scrolling along the neck
- Export of takes
- Optional cloud sync; default remains on-device

## What stays from the current repo

Keep, and eventually share as libraries / mirrored Python ports:

- Fretboard layout and coloring rules
- Scale / chord theory (`tonal`-style helpers, CAGED)
- Ear trainer and chord explorer as dashboard modules

Do not force the camera pipeline through Remix. Local hardware (camera, mic, GPU) is a Python process.

## Suggested repo shape over time

```
jam-dashboard/
  app/                 # existing Remix web tool
  fretboard_cam/       # iteration 1 camera overlay (this work)
  ROADMAP.md
```

Later we may split `fretboard_cam` into `detect/`, `overlay/`, `dashboard/`, and `agent/` packages. Not yet.
