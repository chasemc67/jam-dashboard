from __future__ import annotations

import numpy as np

from fretboard_cam.record import (
    SessionRecorder,
    point_in_rect,
    record_button_rect,
)


def test_record_button_is_in_the_top_right():
    rect = record_button_rect(1280, 720)
    x1, y1, x2, y2 = rect
    assert x2 <= 1280
    assert y1 < 80
    assert x1 > 1280 / 2
    assert point_in_rect((x1 + x2) // 2, (y1 + y2) // 2, rect)
    assert not point_in_rect(10, 10, rect)


def test_session_recorder_writes_raw_and_overlay(tmp_path):
    rec = SessionRecorder(root=tmp_path)
    session = rec.start(160, 120, 12.0)
    assert (session / "README.txt").exists()
    raw = np.zeros((120, 160, 3), dtype=np.uint8)
    overlay = np.full((120, 160, 3), 40, dtype=np.uint8)
    for _ in range(6):
        rec.write(raw, overlay)
    stopped = rec.stop()
    assert stopped == session
    assert not rec.active
    assert (session / "raw.mp4").exists()
    assert (session / "overlay.mp4").exists()
    assert (session / "raw.mp4").stat().st_size > 0
    assert (session / "overlay.mp4").stat().st_size > 0
