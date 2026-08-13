from __future__ import annotations

import numpy as np

from fretboard_cam.neck import neck_quad_from_lines, neck_quad_from_mask
from fretboard_cam.synthetic import make_synthetic_frame, make_tele_style_frame


def _guitar_mask(width: int = 400, height: int = 240) -> np.ndarray:
    """Wide body blob on the right, thin neck going left — like a guitar silhouette."""
    mask = np.zeros((height, width), dtype=np.uint8)
    # Neck: thin band.
    mask[100:140, 20:250] = 255
    # Body: much wider blob.
    yy, xx = np.ogrid[:height, :width]
    body = ((xx - 310) ** 2) / (70**2) + ((yy - 120) ** 2) / (90**2) <= 1
    mask[body] = 255
    return mask


def test_neck_quad_ignores_the_wide_body():
    mask = _guitar_mask()
    quad = neck_quad_from_mask(mask)
    assert quad is not None
    xs = quad[:, 0]
    # The extracted quad should live on the thin neck, not the round body.
    assert xs.max() < 280
    assert xs.min() < 80
    height = np.linalg.norm(quad[0] - quad[3])
    length = np.linalg.norm(quad[0] - quad[1])
    assert length > height * 2


def test_line_detector_finds_synthetic_strings():
    frame, corners = make_synthetic_frame()
    quad = neck_quad_from_lines(frame)
    assert quad is not None
    for pt in quad:
        nearest = float(np.linalg.norm(pt - corners, axis=1).min())
        assert nearest < 60


def test_line_detector_prefers_maple_neck_over_pickguard_strings():
    frame, corners = make_tele_style_frame()
    box = np.array([40.0, 180.0, 900.0, 420.0], dtype=np.float32)
    quad = neck_quad_from_lines(frame, box)
    assert quad is not None
    # Stay on the fretboard, not the dark pickguard to the right of x~520.
    assert float(quad[:, 0].max()) < 620
    assert float(quad[:, 0].min()) < 160
    width = float(np.linalg.norm(quad[0] - quad[3]))
    length = float(np.linalg.norm(quad[0] - quad[1]))
    assert 20 < width < 140
    assert length > width * 2.5
    for pt in quad:
        nearest = float(np.linalg.norm(pt - corners, axis=1).min())
        assert nearest < 80
