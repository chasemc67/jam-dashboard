"""CLI for live/video fretboard overlay."""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np

from .detect import Detector, build_detector
from .overlay import DEFAULT_HIGHLIGHTS, OverlayConfig, draw_fretboard_overlay, draw_hud
from .record import SessionRecorder, draw_record_button, point_in_rect
from .track import QuadTracker

WINDOW_NAME = "Jam Dashboard — fretboard overlay"


def parse_corners(raw: str) -> np.ndarray:
    values = [float(part.strip()) for part in raw.replace(" ", ",").split(",") if part.strip()]
    if len(values) != 8:
        raise argparse.ArgumentTypeError(
            "corners must be 8 numbers: nut_bass_x,nut_bass_y,body_bass_x,body_bass_y,"
            "body_treble_x,body_treble_y,nut_treble_x,nut_treble_y"
        )
    return np.array(values, dtype=np.float32).reshape(4, 2)


def parse_highlights(raw: str) -> list[tuple[int, int]]:
    cells: list[tuple[int, int]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        string_s, fret_s = part.split(":")
        cells.append((int(string_s), int(fret_s)))
    if not cells:
        raise argparse.ArgumentTypeError("highlights must look like 6:3,5:5,1:3")
    return cells


def open_source(source: str) -> cv2.VideoCapture:
    if source.isdigit():
        index = int(source)
        cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
        if not cap.isOpened():
            cap = cv2.VideoCapture(index)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)
    else:
        cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"could not open source: {source}")
    return cap


def make_writer(
    path: str,
    width: int,
    height: int,
    fps: float,
) -> cv2.VideoWriter:
    from .record import make_writer as _make_writer

    return _make_writer(Path(path), width, height, fps)


def process_stream(
    cap: cv2.VideoCapture,
    detector: Detector,
    *,
    overlay_config: OverlayConfig,
    detect_every: int,
    max_frames: int,
    output_path: str | None,
    save_frames_dir: str | None,
    save_frame_every: int,
    debug: bool,
    preview: bool,
) -> int:
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    writer = None
    tracker = QuadTracker()
    recorder = SessionRecorder()
    processed = 0
    last_conf: float | None = None
    last_label = detector.name
    frame_times: deque[float] = deque(maxlen=30)
    last_tick = time.perf_counter()
    live_fps = 0.0
    button_rect = (0, 0, 0, 0)
    ui = {"click": None}

    if save_frames_dir:
        Path(save_frames_dir).mkdir(parents=True, exist_ok=True)

    if preview:
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

        def _on_mouse(event: int, x: int, y: int, _flags: int, _param: object) -> None:
            if event == cv2.EVENT_LBUTTONDOWN:
                ui["click"] = (x, y)

        cv2.setMouseCallback(WINDOW_NAME, _on_mouse)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if width == 0 or height == 0:
                height, width = frame.shape[:2]
            if writer is None and output_path:
                writer = make_writer(output_path, width, height, fps)

            now = time.perf_counter()
            frame_times.append(now - last_tick)
            last_tick = now
            if frame_times:
                live_fps = 1.0 / max(sum(frame_times) / len(frame_times), 1e-3)

            searching = not tracker.locked
            interval = 3 if searching else max(1, detect_every)
            should_detect = processed % interval == 0
            detection = detector.detect(frame) if should_detect else None
            detected_corners = None if detection is None else detection.corners
            if detection is not None:
                last_conf = detection.confidence
                last_label = detection.label

            corners = tracker.update(frame, detected_corners)
            if corners is not None:
                vis = draw_fretboard_overlay(frame, corners, overlay_config)
            else:
                vis = frame.copy()
            vis = draw_hud(
                vis,
                detector=f"{detector.name}/{last_label}",
                tracked=corners is not None,
                confidence=last_conf,
                extra_lines=[
                    f"frame {processed}  {live_fps:.1f} fps",
                    f"frets {overlay_config.visible_frets}  alpha {overlay_config.alpha:.2f}",
                    "click REC or press R   Q quit",
                ],
            )
            if debug and detection is not None and detection.box_xyxy is not None:
                x1, y1, x2, y2 = [int(round(v)) for v in detection.box_xyxy]
                cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 255), 2)

            button_rect = draw_record_button(vis, recorder.active)
            if recorder.active:
                recorder.write(frame, vis)

            if writer is not None:
                writer.write(vis)
            if save_frames_dir and processed % max(1, save_frame_every) == 0:
                cv2.imwrite(
                    os.path.join(save_frames_dir, f"overlay_{processed:05d}.jpg"),
                    vis,
                    [int(cv2.IMWRITE_JPEG_QUALITY), 92],
                )

            if preview:
                cv2.imshow(WINDOW_NAME, vis)
                key = cv2.waitKey(1) & 0xFF
                clicked = ui["click"]
                ui["click"] = None
                toggle_record = key in (ord("r"), ord("R"))
                if clicked is not None and point_in_rect(clicked[0], clicked[1], button_rect):
                    toggle_record = True
                if toggle_record:
                    rec_fps = live_fps if live_fps > 1 else 15.0
                    recorder.toggle(width, height, rec_fps)
                if key in (ord("q"), ord("Q"), 27):
                    break

            processed += 1
            if max_frames and processed >= max_frames:
                break
            if processed % 30 == 0:
                print(
                    f"processed {processed} frames, lock={tracker.locked}, {live_fps:.1f} fps",
                    flush=True,
                )
    finally:
        if recorder.active:
            recorder.stop()
        cap.release()
        if writer is not None:
            writer.release()
        if preview:
            cv2.destroyAllWindows()
    return processed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Overlay numbered fret markers on a detected guitar neck."
    )
    parser.add_argument(
        "--source",
        default="0",
        help="Webcam index, video path, or image path.",
    )
    parser.add_argument("--output", default=None, help="Optional mp4 output path.")
    parser.add_argument(
        "--detector",
        default="yolo-world",
        choices=["yolo-world", "yolo-coco", "contour", "manual"],
        help="yolo-world uses open-vocabulary prompts (no training). "
        "manual requires --corners. contour is for high-contrast / synthetic necks.",
    )
    parser.add_argument(
        "--corners",
        type=parse_corners,
        default=None,
        help="Eight numbers for a manual quad (nut_bass, body_bass, body_treble, nut_treble).",
    )
    parser.add_argument("--visible-frets", type=int, default=12)
    parser.add_argument("--alpha", type=float, default=0.42)
    parser.add_argument(
        "--highlights",
        type=parse_highlights,
        default=None,
        help="Comma-separated string:fret cells, e.g. 6:3,5:5,1:3",
    )
    parser.add_argument("--detect-every", type=int, default=8)
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--save-frames-dir", default=None)
    parser.add_argument("--save-frame-every", type=int, default=30)
    parser.add_argument("--no-grid", action="store_true")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Do not open a live window (useful for file-only processing).",
    )
    parser.add_argument(
        "--label",
        default="DEMO  numbered frets",
        help="HUD label drawn on the overlay.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.detector == "manual" and args.corners is None:
        raise SystemExit("manual detector requires --corners")

    detector = build_detector(args.detector, corners=args.corners)
    config = OverlayConfig(
        visible_frets=args.visible_frets,
        alpha=args.alpha,
        highlights=args.highlights or DEFAULT_HIGHLIGHTS,
        draw_grid=not args.no_grid,
        label=args.label,
    )
    cap = open_source(args.source)
    if not args.no_preview:
        print(
            "Live preview: point the camera at a guitar neck.\n"
            "  REC button or R  start/stop recording (saves raw.mp4 + overlay.mp4)\n"
            "  Q                quit",
            flush=True,
        )
    processed = process_stream(
        cap,
        detector,
        overlay_config=config,
        detect_every=args.detect_every,
        max_frames=args.max_frames,
        output_path=args.output,
        save_frames_dir=args.save_frames_dir,
        save_frame_every=args.save_frame_every,
        debug=args.debug,
        preview=not args.no_preview,
    )
    print(f"done, {processed} frames")
    return 0 if processed else 1


if __name__ == "__main__":
    sys.exit(main())
