"""CLI for live/video fretboard overlay."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import cv2
import numpy as np

from .detect import Detector, build_detector
from .overlay import DEFAULT_HIGHLIGHTS, OverlayConfig, draw_fretboard_overlay, draw_hud
from .track import QuadTracker


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
        cap = cv2.VideoCapture(int(source))
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
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, max(fps, 1.0), (width, height))
    if not writer.isOpened():
        raise SystemExit(f"could not open video writer: {path}")
    return writer


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
) -> int:
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    writer = None
    tracker = QuadTracker()
    processed = 0
    last_conf: float | None = None
    last_label = detector.name

    if save_frames_dir:
        Path(save_frames_dir).mkdir(parents=True, exist_ok=True)

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if width == 0 or height == 0:
            height, width = frame.shape[:2]
        if writer is None and output_path:
            writer = make_writer(output_path, width, height, fps)

        should_detect = processed % max(1, detect_every) == 0 or not tracker.locked
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
                f"frame {processed}",
                f"frets {overlay_config.visible_frets}  alpha {overlay_config.alpha:.2f}",
            ],
        )
        if debug and detection is not None and detection.box_xyxy is not None:
            x1, y1, x2, y2 = [int(round(v)) for v in detection.box_xyxy]
            cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 255), 2)

        if writer is not None:
            writer.write(vis)
        if (
            save_frames_dir
            and processed % max(1, save_frame_every) == 0
        ):
            cv2.imwrite(
                os.path.join(save_frames_dir, f"overlay_{processed:05d}.jpg"),
                vis,
                [int(cv2.IMWRITE_JPEG_QUALITY), 92],
            )

        processed += 1
        if max_frames and processed >= max_frames:
            break
        if processed % 30 == 0:
            print(f"processed {processed} frames, lock={tracker.locked}", flush=True)

    cap.release()
    if writer is not None:
        writer.release()
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
    )
    print(f"done, {processed} frames")
    return 0 if processed else 1


if __name__ == "__main__":
    sys.exit(main())
