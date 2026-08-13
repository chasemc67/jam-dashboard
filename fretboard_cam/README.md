# fretboard_cam

Standalone Python prototype for the first demo of Jam Dashboard's next version: **lock a grid of numbered markers onto a guitar neck in a camera/video feed**.

This is intentionally *not* wired into the existing Remix/TypeScript app. The overlay only needs to prove we can find a fretboard and paint something on it. Markers are arbitrary `(string, fret)` cells — not a real scale.

## Approach (no custom training)

We avoided training a CNN for this pass. The pipeline is:

1. **Detect a guitar box** with a pretrained open-vocabulary model ([YOLO-World](https://docs.ultralytics.com/models/yolo-world/)), prompted with `guitar neck` / `guitar fretboard` / `guitar`. COCO YOLOv8 (`guitar` class) is a fallback. Neither requires labeling data.
2. **Turn the box into a neck quad** by clustering parallel string/neck-edge lines, then keeping the bundle whose *interior is maple-bright* (not the dark pickguard) and whose width looks like a neck. The longest maple run along that band is the fretboard; it stops where the wood hits the pickguard or a lamp flare. Fallbacks: GrabCut + a thin-region profile, then `--corners`.
3. **Track** those corners with Lucas-Kanade optical flow and a light blend so the overlay does not jump every frame.
4. **Overlay** a perspective-correct grid. Fret spacing uses the standard 12-TET formula `1 - 2^(-n/12)`. Highlighted cells are hardcoded fret numbers.

If auto-detect is wrong on a given guitar/camera, pass `--corners` once (the same idea as `capture-ref` in the reference recording) and the tracker will carry the quad forward.

**When we would train:** if YOLO-World cannot lock onto *your* guitar from a typical practice-cam angle, the next step is a small YOLO-OBB dataset of fretboards (a few hundred frames), not a from-scratch CNN. Manual `--corners` is enough to keep iterating until then.

## Setup

```bash
cd fretboard_cam
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt          # geometry, overlay, tests
pip install -r requirements-ml.txt       # YOLO-World / COCO YOLO
```

On a machine with a display, install `opencv-python` instead of `opencv-python-headless` if you want a live preview window later.

## Run

Webcam (local machine, live window):

```bash
python -m fretboard_cam --source 0 --detector yolo-world --debug
```

A window opens. Point the camera at a guitar neck.

- Click **REC** (top right) or press **R** to start/stop recording
- Each take writes `recordings/<timestamp>/raw.mp4` (no overlay) and `overlay.mp4` (with overlay)
- Press **Q** to quit

On a Mac, grant camera access to Terminal (or Cursor) if macOS asks.

`--no-preview` skips the window (useful for file-only processing). `--output overlay.mp4` also records the overlay stream from the CLI.

Video file:

```bash
python -m fretboard_cam \
  --source path/to/guitar.mp4 \
  --detector yolo-world \
  --visible-frets 12 \
  --highlights 6:3,6:5,5:3,5:5,4:2,4:4,1:3,1:5 \
  --output output/overlay.mp4 \
  --save-frames-dir output/frames \
  --debug
```

Known quad, no neural net:

```bash
python -m fretboard_cam \
  --source path/to/guitar.mp4 \
  --detector manual \
  --corners 120,360,820,390,800,230,150,250 \
  --output output/overlay.mp4
```

High-contrast / synthetic necks:

```bash
python -m fretboard_cam --source synthetic.mp4 --detector contour --output overlay.mp4
```

`--highlights` is `string:fret` with string 1 = high E and string 6 = low E.

## Tests

```bash
cd fretboard_cam
python -m pytest -q
```

Tests cover fret math, corner ordering, overlay painting, contour detection on a synthetic neck, optical-flow tracking, and neck isolation from a guitar-shaped mask. They do not download YOLO weights.

This prototype was run on:

- A moving synthetic neck (contour lock, numbered cells stay on the board)
- A public PLOS ONE electric-guitar clip (YOLO-World `guitar` + parallel string lines, lock held for the processed take)
- The author's FaceTime Telecaster clip in `testdata/chase-tele-20260812/` (maple neck vs black pickguard; the fitter now scores light-wood interiors so it does not treat pickguard strings as the fretboard)

`--corners` is the escape hatch if auto-detect is off on your guitar/camera.

## Layout

```
fretboard_cam/
  geometry.py   # fret spacing, homography, corner order
  overlay.py    # translucent cells + numbered dots
  detect.py     # yolo-world / yolo-coco / contour / manual
  track.py      # optical flow + blending
  app.py        # CLI
  synthetic.py  # fake neck for tests
```
