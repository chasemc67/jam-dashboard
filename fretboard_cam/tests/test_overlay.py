from __future__ import annotations

import cv2
import numpy as np

from fretboard_cam.detect import ContourDetector, ManualDetector
from fretboard_cam.geometry import project_cell
from fretboard_cam.overlay import OverlayConfig, draw_fretboard_overlay
from fretboard_cam.synthetic import make_synthetic_frame, moving_corners
from fretboard_cam.track import QuadTracker


def _inside_quad(point: np.ndarray, quad: np.ndarray) -> bool:
    return (
        cv2.pointPolygonTest(
            quad.astype(np.float32),
            (float(point[0]), float(point[1])),
            False,
        )
        >= 0
    )


def test_overlay_paints_highlighted_cells_inside_the_board():
    frame, corners = make_synthetic_frame()
    config = OverlayConfig(
        visible_frets=12,
        highlights=((6, 3), (1, 5)),
        alpha=1.0,
        draw_grid=False,
        draw_quad=False,
        draw_labels=False,
        label="",
    )
    painted = draw_fretboard_overlay(frame, corners, config)
    delta = cv2.absdiff(frame, painted)
    assert int(np.count_nonzero(delta)) > 500
    cell = project_cell(6, 3, corners, visible_frets=12)
    sample = cell.mean(axis=0).astype(int)
    assert not np.array_equal(
        painted[sample[1], sample[0]],
        frame[sample[1], sample[0]],
    )
    assert np.array_equal(painted[20, 20], frame[20, 20])


def test_manual_detector_returns_ordered_corners():
    frame, corners = make_synthetic_frame()
    shuffled = corners[[2, 0, 3, 1]]
    detection = ManualDetector(shuffled).detect(frame)
    assert detection is not None
    np.testing.assert_allclose(detection.corners, corners, atol=1e-3)


def test_contour_detector_finds_synthetic_neck():
    frame, corners = make_synthetic_frame()
    detection = ContourDetector().detect(frame)
    assert detection is not None
    for pt in detection.corners:
        nearest = float(np.linalg.norm(pt - corners, axis=1).min())
        assert _inside_quad(pt, corners) or nearest < 50


def test_tracker_follows_a_moving_board():
    tracker = QuadTracker(blend=1.0)
    base = None
    last = None
    for i in range(12):
        corners = moving_corners(i, dx=3.0, dy=1.0)
        frame, ordered = make_synthetic_frame(corners=corners)
        if i == 0:
            base = ordered
        last = tracker.update(frame, ordered if i % 4 == 0 else None)
        assert last is not None
    assert last is not None
    assert base is not None
    assert last[:, 0].mean() > base[:, 0].mean() + 10
    assert last[:, 1].mean() > base[:, 1].mean()
