"""Fretboard geometry: equal-temperament spacing, corner ordering, homography."""

from __future__ import annotations

from typing import Iterable

import cv2
import numpy as np

NUM_STRINGS = 6
CANONICAL_CORNERS = np.array(
    [
        [0.0, 0.0],  # nut, bass
        [1.0, 0.0],  # body, bass
        [1.0, 1.0],  # body, treble
        [0.0, 1.0],  # nut, treble
    ],
    dtype=np.float32,
)


def fret_distance_from_nut(fret: int, scale_length: float = 1.0) -> float:
    """Distance from the nut to a fret using standard 12-TET placement."""
    if fret < 0:
        raise ValueError("fret must be >= 0")
    return float(scale_length * (1.0 - 2.0 ** (-fret / 12.0)))


def normalized_fret_xs(visible_frets: int) -> np.ndarray:
    """x coordinates of the nut plus frets 1..visible_frets, mapped into [0, 1]."""
    if visible_frets < 1:
        raise ValueError("visible_frets must be >= 1")
    end = fret_distance_from_nut(visible_frets)
    xs = [0.0]
    for fret in range(1, visible_frets + 1):
        xs.append(fret_distance_from_nut(fret) / end)
    return np.asarray(xs, dtype=np.float32)


def string_number_to_lane(string_number: int, num_strings: int = NUM_STRINGS) -> int:
    """Map guitar string number (1=high E, 6=low E) to a bass-origin lane index."""
    if not 1 <= string_number <= num_strings:
        raise ValueError(f"string_number must be in 1..{num_strings}")
    return num_strings - string_number


def string_center_y(string_number: int, num_strings: int = NUM_STRINGS) -> float:
    """Canonical y of a string center. Bass (6) is near 0, treble (1) is near 1."""
    lane = string_number_to_lane(string_number, num_strings)
    return (lane + 0.5) / num_strings


def cell_canonical_quad(
    string_number: int,
    fret: int,
    visible_frets: int,
    num_strings: int = NUM_STRINGS,
) -> np.ndarray:
    """Return the 4 canonical corners of the cell between fret-1 and fret.

    Order: bass-nut-side, bass-body-side, treble-body-side, treble-nut-side.
    """
    if fret < 1:
        raise ValueError("fret must be >= 1 (open string has no cell)")
    if fret > visible_frets:
        raise ValueError("fret cannot exceed visible_frets")
    xs = normalized_fret_xs(visible_frets)
    x0, x1 = float(xs[fret - 1]), float(xs[fret])
    lane = string_number_to_lane(string_number, num_strings)
    y0 = lane / num_strings
    y1 = (lane + 1) / num_strings
    return np.array(
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        dtype=np.float32,
    )


def cell_canonical_center(
    string_number: int,
    fret: int,
    visible_frets: int,
    num_strings: int = NUM_STRINGS,
) -> np.ndarray:
    quad = cell_canonical_quad(string_number, fret, visible_frets, num_strings)
    return quad.mean(axis=0).astype(np.float32)


def order_fretboard_corners(points: Iterable[Iterable[float]]) -> np.ndarray:
    """Order 4 points as nut_bass, body_bass, body_treble, nut_treble.

    The long axis of the quad is treated as nut→body. The narrower end is the
    nut when a taper is present; otherwise the end with smaller mean x wins
    (typical camera framing with the headstock on the left).
    """
    pts = np.asarray(list(points), dtype=np.float32).reshape(4, 2)
    mean = pts.mean(axis=0)
    centered = pts - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    long_axis = eigvecs[:, int(np.argmax(eigvals))]
    proj = centered @ long_axis
    order = np.argsort(proj)
    end_a = pts[order[:2]]
    end_b = pts[order[2:]]

    width_a = float(np.linalg.norm(end_a[0] - end_a[1]))
    width_b = float(np.linalg.norm(end_b[0] - end_b[1]))
    mean_a = end_a.mean(axis=0)
    mean_b = end_b.mean(axis=0)

    nut, body = end_a, end_b
    if width_b < width_a * 0.92:
        nut, body = end_b, end_a
    elif width_a < width_b * 0.92:
        nut, body = end_a, end_b
    else:
        # No clear taper: prefer the end that is more "headstock-left".
        if mean_b[0] < mean_a[0]:
            nut, body = end_b, end_a

    nut = nut[np.argsort(nut[:, 1])]
    body = body[np.argsort(body[:, 1])]
    nut_treble, nut_bass = nut[0], nut[1]
    body_treble, body_bass = body[0], body[1]
    return np.stack([nut_bass, body_bass, body_treble, nut_treble]).astype(np.float32)


def quad_from_min_area_rect(points: np.ndarray) -> np.ndarray:
    """Fit a min-area rectangle to a point set and return ordered corners."""
    pts = np.asarray(points, dtype=np.float32).reshape(-1, 2)
    rect = cv2.minAreaRect(pts)
    box = cv2.boxPoints(rect)
    return order_fretboard_corners(box)


def quad_from_contour(contour: np.ndarray) -> np.ndarray:
    """Approximate a contour as an ordered fretboard quad."""
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
    if len(approx) == 4:
        return order_fretboard_corners(approx.reshape(4, 2))
    return quad_from_min_area_rect(contour.reshape(-1, 2))


def fretboard_homography(image_corners: np.ndarray) -> np.ndarray:
    """Homography mapping canonical [0,1]x[0,1] onto the image quad."""
    corners = np.asarray(image_corners, dtype=np.float32).reshape(4, 2)
    matrix, _ = cv2.findHomography(CANONICAL_CORNERS, corners)
    if matrix is None:
        raise ValueError("could not compute fretboard homography")
    return matrix.astype(np.float32)


def canonical_to_image(points: np.ndarray, homography: np.ndarray) -> np.ndarray:
    pts = np.asarray(points, dtype=np.float32).reshape(-1, 1, 2)
    mapped = cv2.perspectiveTransform(pts, homography)
    return mapped.reshape(-1, 2).astype(np.float32)


def image_to_canonical(points: np.ndarray, homography: np.ndarray) -> np.ndarray:
    inverse = np.linalg.inv(homography)
    return canonical_to_image(points, inverse)


def project_cell(
    string_number: int,
    fret: int,
    image_corners: np.ndarray,
    visible_frets: int,
    num_strings: int = NUM_STRINGS,
) -> np.ndarray:
    homography = fretboard_homography(image_corners)
    quad = cell_canonical_quad(string_number, fret, visible_frets, num_strings)
    return canonical_to_image(quad, homography)
