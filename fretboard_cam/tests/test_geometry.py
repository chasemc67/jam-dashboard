from __future__ import annotations

import numpy as np
import pytest

from fretboard_cam.geometry import (
    cell_canonical_center,
    cell_canonical_quad,
    fret_distance_from_nut,
    fretboard_homography,
    image_to_canonical,
    normalized_fret_xs,
    order_fretboard_corners,
    project_cell,
    string_center_y,
)


def test_twelfth_fret_is_half_scale():
    assert fret_distance_from_nut(12) == pytest.approx(0.5)


def test_normalized_frets_span_zero_to_one():
    xs = normalized_fret_xs(12)
    assert xs[0] == pytest.approx(0.0)
    assert xs[-1] == pytest.approx(1.0)
    assert xs[12] == pytest.approx(1.0)
    assert np.all(np.diff(xs) > 0)


def test_lower_frets_are_wider_than_higher_frets():
    xs = normalized_fret_xs(12)
    first = xs[1] - xs[0]
    last = xs[-1] - xs[-2]
    assert first > last


def test_string_centers_run_bass_to_treble():
    assert string_center_y(6) < string_center_y(1)
    assert string_center_y(6) == pytest.approx(1 / 12)
    assert string_center_y(1) == pytest.approx(11 / 12)


def test_order_fretboard_corners_with_tapered_neck():
    shuffled = np.array(
        [
            [800.0, 230.0],  # body treble
            [120.0, 360.0],  # nut bass
            [150.0, 250.0],  # nut treble
            [820.0, 390.0],  # body bass
        ],
        dtype=np.float32,
    )
    ordered = order_fretboard_corners(shuffled)
    nut_width = np.linalg.norm(ordered[0] - ordered[3])
    body_width = np.linalg.norm(ordered[1] - ordered[2])
    assert nut_width < body_width
    assert ordered[0, 1] > ordered[3, 1]  # bass below treble in image coords
    assert ordered[0, 0] < ordered[1, 0]  # nut left of body


def test_order_fretboard_corners_without_taper_uses_left_as_nut():
    rectangle = np.array(
        [
            [400.0, 100.0],
            [100.0, 100.0],
            [400.0, 200.0],
            [100.0, 200.0],
        ],
        dtype=np.float32,
    )
    ordered = order_fretboard_corners(rectangle)
    assert ordered[0, 0] == pytest.approx(100.0)  # nut bass x
    assert ordered[1, 0] == pytest.approx(400.0)  # body bass x


def test_homography_roundtrip():
    corners = np.array(
        [
            [100.0, 300.0],
            [700.0, 320.0],
            [680.0, 180.0],
            [120.0, 200.0],
        ],
        dtype=np.float32,
    )
    H = fretboard_homography(corners)
    canonical = np.array([[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]], dtype=np.float32)
    back = image_to_canonical(corners, H)
    np.testing.assert_allclose(back, canonical, atol=1e-3)


def test_cell_center_is_inside_cell_quad():
    quad = cell_canonical_quad(6, 3, visible_frets=12)
    center = cell_canonical_center(6, 3, visible_frets=12)
    xs, ys = quad[:, 0], quad[:, 1]
    assert xs.min() <= center[0] <= xs.max()
    assert ys.min() <= center[1] <= ys.max()


def test_project_cell_lands_near_nut_for_fret_one_bass():
    corners = np.array(
        [
            [100.0, 300.0],
            [700.0, 320.0],
            [680.0, 180.0],
            [120.0, 200.0],
        ],
        dtype=np.float32,
    )
    cell = project_cell(6, 1, corners, visible_frets=12)
    # Fret 1 on the low E should sit against the nut, bass side.
    assert cell[:, 0].mean() < 250
    assert cell[:, 1].mean() > 240
