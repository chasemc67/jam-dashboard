# Reproduce the hand comparison on the Mini

Use an isolated checkout, Python 3.12, the packages in
`hands-eval-requirements.txt`, and an arm64 release build of FretTrackerCLI
(`swift build --package-path desktop/native -c release --disable-sandbox`).
The script expects a compiled V4Q832 model and the following under `eval-models/`:

- `EfficientSAM/`: upstream commit `d525f622e6f640acf5a0fc37c7ca1f243da5bde0`, including `weights/efficient_sam_vitt.pt`.
- `hand_landmarker.task`: float16 v1.
- `selfie_multiclass_256x256.tflite`: float32 v1.

Download URLs, license evidence and hashes are in `../THIRD_PARTY.md`. These files
and Python environments belong outside version control and are not app resources.

From the checkout root (adjust paths):

```sh
.venv/bin/python desktop/native/scripts/eval_hands.py \
  --video ../clips/2026-09-06_09-00-01.mp4 --start 30 --flip \
  --model ../repo/desktop/native/dist/FretTrackerV4Q832.mlmodelc \
  --out ../out/hands/09-06
.venv/bin/python desktop/native/scripts/eval_hands.py \
  --video ../clips/yt_nBpe2YQEzZo.mp4 --start 10 \
  --model ../repo/desktop/native/dist/FretTrackerV4Q832.mlmodelc \
  --out ../out/hands/held-out
```

Each run samples 225 frames over 15 seconds at 15 fps, feeding 832-square RGBA
letterboxes to the real native protocol. `--native-only --seconds 0.2` is a quick
orientation/protocol probe. Do not benchmark alongside builds or another run.
Outputs are a seven-panel H.264 MP4, five review stills, raw native JSON, alpha masks
in NPZ, and median/p95 latency JSON (first five frames omitted).

Order: off, Vision fast, Vision fast @50%, Vision balanced, skin, MediaPipe hand + multiclass
body-skin, EfficientSAM-Ti with Vision box prompts. Each frame uses the SAME
V4Q832 no-cutout homography across all panels, and C-major patches rendered with
the app's canonical plane equations, plus wires/strings. This offline renderer
uses OpenCV, not the app's WebGL renderer; actual app screenshots come from
`desktop/e2e/live-fretboard.mjs --hand-cutout <option>`.

Timings are additional hand-processing milliseconds, excluding decoding, model
load, fretboard inference and video encoding. Native hand timings include pose,
segmentation, ROI gating and alpha extraction. MediaPipe uses CPU Tasks IMAGE
mode; EfficientSAM uses PyTorch MPS, internally resizes the 832 image to 1024, and
synchronizes through CPU mask extraction. SAM's per-frame time adds the separately
measured Vision+skin baseline cost as a conservative proxy for prompt generation
(slightly overcounting the skin threshold). These two options are Python quality
evaluations, not claims of Swift/CoreML speed. Models are warm after five frames.
The MP4 plays at source-time 15 fps even when offline inference is slower.

The original 09-06 recording has the neck pointing left and needs `--flip`;
the held-out recording needs no flip. Masks remain in canonical input coordinates
until cropped/unmirrored for composition. Camera display mirroring is covered by
renderer geometry tests; these offline files are shown in recorded orientation.

To re-render using saved masks and measurements without running inference:

```sh
.venv/bin/python desktop/native/scripts/eval_hands.py \
  --render-only --video ../clips/2026-09-06_09-00-01.mp4 --out ../out/hands/09-06
```

Render-only mode restores the source path, start, duration, fps and flip from
`latency.json` and reads `masks.npz` plus `off.json` from the output directory.
The seven panels use a 2560×720 grid with an empty eighth cell. The 50% panel
reuses Vision fast masks and timing; overlay alpha is multiplied by
`1 - 0.5 * mask`. For an actual app capture, pass `--hand-cutout vision-fast
--hand-opacity 50` to the e2e script (opacity accepts percentages from 0 to 100).
