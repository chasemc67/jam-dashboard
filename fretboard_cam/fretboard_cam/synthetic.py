"""Helpers for drawing a fake guitar neck used by tests and local demos."""

from __future__ import annotations

import cv2
import numpy as np

from .geometry import (
    canonical_to_image,
    fretboard_homography,
    normalized_fret_xs,
    order_fretboard_corners,
)


def make_synthetic_frame(
    width: int = 960,
    height: int = 540,
    corners: np.ndarray | None = None,
    visible_frets: int = 12,
    background: tuple[int, int, int] = (30, 30, 30),
    board_color: tuple[int, int, int] = (70, 160, 210),
) -> tuple[np.ndarray, np.ndarray]:
    """Render a trapezoid fretboard with strings and frets.

    Returns (frame, ordered_corners).
    """
    if corners is None:
        corners = np.array(
            [
                [120.0, 360.0],  # nut bass
                [820.0, 390.0],  # body bass
                [800.0, 230.0],  # body treble
                [150.0, 250.0],  # nut treble
            ],
            dtype=np.float32,
        )
    ordered = order_fretboard_corners(corners)
    frame = np.full((height, width, 3), background, dtype=np.uint8)
    cv2.fillConvexPoly(frame, np.round(ordered).astype(np.int32), board_color)

    homography = fretboard_homography(ordered)
    xs = normalized_fret_xs(visible_frets)
    for x in xs:
        line = canonical_to_image(
            np.array([[x, 0.02], [x, 0.98]], dtype=np.float32), homography
        )
        cv2.line(
            frame,
            tuple(np.round(line[0]).astype(int)),
            tuple(np.round(line[1]).astype(int)),
            (40, 40, 40),
            2,
            cv2.LINE_AA,
        )
    for i in range(6):
        y = (i + 0.5) / 6.0
        line = canonical_to_image(
            np.array([[0.0, y], [1.0, y]], dtype=np.float32), homography
        )
        cv2.line(
            frame,
            tuple(np.round(line[0]).astype(int)),
            tuple(np.round(line[1]).astype(int)),
            (20, 20, 20),
            1,
            cv2.LINE_AA,
        )
    return frame, ordered


def moving_corners(
    frame_index: int,
    base: np.ndarray | None = None,
    dx: float = 1.4,
    dy: float = 0.4,
) -> np.ndarray:
    if base is None:
        base = np.array(
            [
                [120.0, 360.0],
                [820.0, 390.0],
                [800.0, 230.0],
                [150.0, 250.0],
            ],
            dtype=np.float32,
        )
    offset = np.array([frame_index * dx, frame_index * dy], dtype=np.float32)
    return order_fretboard_corners(base + offset)
