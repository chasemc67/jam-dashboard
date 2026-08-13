from __future__ import annotations

from fretboard_cam.app import parse_corners, parse_highlights


def test_parse_corners():
    pts = parse_corners("1,2,3,4,5,6,7,8")
    assert pts.shape == (4, 2)
    assert pts[0, 0] == 1
    assert pts[3, 1] == 8


def test_parse_highlights():
    cells = parse_highlights("6:3, 1:5,2:7")
    assert cells == [(6, 3), (1, 5), (2, 7)]
