"""On-screen record control and dual (raw + overlay) capture."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

BUTTON_SIZE = (168, 54)
BUTTON_MARGIN = 16


def recordings_root() -> Path:
    return Path(__file__).resolve().parent.parent / "recordings"


def record_button_rect(frame_w: int, frame_h: int) -> tuple[int, int, int, int]:
    bw, bh = BUTTON_SIZE
    x1 = frame_w - bw - BUTTON_MARGIN
    y1 = BUTTON_MARGIN
    return x1, y1, x1 + bw, y1 + bh


def point_in_rect(x: int, y: int, rect: tuple[int, int, int, int]) -> bool:
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def draw_record_button(frame: np.ndarray, recording: bool) -> tuple[int, int, int, int]:
    """Draw a clickable REC/STOP button in the top-right. Returns its rect."""
    h, w = frame.shape[:2]
    rect = record_button_rect(w, h)
    x1, y1, x2, y2 = rect
    fill = (40, 40, 180) if recording else (40, 40, 40)
    border = (60, 60, 255) if recording else (220, 220, 220)
    cv2.rectangle(frame, (x1, y1), (x2, y2), fill, -1)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    cx, cy = x1 + 28, (y1 + y2) // 2
    cv2.circle(frame, (cx, cy), 10, (40, 40, 255), -1, lineType=cv2.LINE_AA)
    if recording:
        cv2.circle(frame, (cx, cy), 14, (80, 80, 255), 2, lineType=cv2.LINE_AA)
    label = "STOP" if recording else "REC"
    cv2.putText(
        frame,
        label,
        (x1 + 48, y1 + 36),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    return rect


def make_writer(path: Path, width: int, height: int, fps: float) -> cv2.VideoWriter:
    path.parent.mkdir(parents=True, exist_ok=True)
    fps = max(float(fps), 8.0)
    for codec in ("avc1", "mp4v"):
        writer = cv2.VideoWriter(
            str(path), cv2.VideoWriter_fourcc(*codec), fps, (width, height)
        )
        if writer.isOpened():
            return writer
        writer.release()
    raise RuntimeError(f"could not open video writer: {path}")


class SessionRecorder:
    """Writes paired raw.mp4 + overlay.mp4 into a timestamped folder."""

    def __init__(self, root: Path | None = None):
        self.root = Path(root) if root is not None else recordings_root()
        self.active = False
        self.session_dir: Path | None = None
        self.raw_writer: cv2.VideoWriter | None = None
        self.overlay_writer: cv2.VideoWriter | None = None
        self.frames_written = 0

    def toggle(self, width: int, height: int, fps: float) -> Path | None:
        if self.active:
            return self.stop()
        self.start(width, height, fps)
        return self.session_dir

    def start(self, width: int, height: int, fps: float) -> Path:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        session = self.root / stamp
        session.mkdir(parents=True, exist_ok=True)
        self.raw_writer = make_writer(session / "raw.mp4", width, height, fps)
        self.overlay_writer = make_writer(session / "overlay.mp4", width, height, fps)
        (session / "README.txt").write_text(
            "Jam Dashboard capture\n"
            "raw.mp4      camera frames with no overlay\n"
            "overlay.mp4  the same frames with the fretboard overlay\n"
            f"size {width}x{height}  fps {fps:.1f}\n",
            encoding="utf-8",
        )
        self.session_dir = session
        self.active = True
        self.frames_written = 0
        print(f"recording → {session}", flush=True)
        return session

    def write(self, raw: np.ndarray, overlay: np.ndarray) -> None:
        if not self.active:
            return
        if self.raw_writer is not None:
            self.raw_writer.write(raw)
        if self.overlay_writer is not None:
            self.overlay_writer.write(overlay)
        self.frames_written += 1

    def stop(self) -> Path | None:
        session = self.session_dir
        if self.raw_writer is not None:
            self.raw_writer.release()
        if self.overlay_writer is not None:
            self.overlay_writer.release()
        self.raw_writer = None
        self.overlay_writer = None
        self.active = False
        if session is not None:
            print(
                f"saved {self.frames_written} frames to {session} "
                f"(raw.mp4 + overlay.mp4)",
                flush=True,
            )
        self.session_dir = None
        return session
