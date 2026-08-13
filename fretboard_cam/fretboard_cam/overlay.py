"""Draw a perspective-correct fretboard overlay onto a video frame."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

import cv2
import numpy as np

from .geometry import (
    NUM_STRINGS,
    canonical_to_image,
    cell_canonical_center,
    cell_canonical_quad,
    fretboard_homography,
    normalized_fret_xs,
)

# Demo pattern: a handful of arbitrary (string, fret) cells. String 1 = high E.
DEFAULT_HIGHLIGHTS: tuple[tuple[int, int], ...] = (
    (1, 3),
    (1, 5),
    (2, 3),
    (2, 5),
    (3, 2),
    (3, 4),
    (3, 5),
    (4, 2),
    (4, 4),
    (5, 3),
    (5, 5),
    (6, 3),
    (6, 5),
    (6, 7),
)

HIGHLIGHT_FILL = (220, 140, 40)  # BGR, close to the demo's translucent blue-cyan
GRID_COLOR = (210, 210, 210)
QUAD_COLOR = (80, 220, 80)
NUT_COLOR = (40, 200, 255)
TEXT_COLOR = (255, 255, 255)


@dataclass(frozen=True)
class OverlayConfig:
    visible_frets: int = 12
    num_strings: int = NUM_STRINGS
    highlights: Sequence[tuple[int, int]] = DEFAULT_HIGHLIGHTS
    alpha: float = 0.42
    draw_grid: bool = True
    draw_quad: bool = True
    draw_labels: bool = True
    label: str = "DEMO  numbered frets"


def _blend_poly(
    frame: np.ndarray,
    points: np.ndarray,
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    overlay = frame.copy()
    cv2.fillConvexPoly(overlay, np.round(points).astype(np.int32), color)
    cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, dst=frame)


def _draw_polyline(
    frame: np.ndarray,
    points: np.ndarray,
    color: tuple[int, int, int],
    thickness: int = 1,
    closed: bool = False,
) -> None:
    pts = np.round(points).astype(np.int32)
    cv2.polylines(frame, [pts], isClosed=closed, color=color, thickness=thickness, lineType=cv2.LINE_AA)


def draw_fretboard_overlay(
    frame: np.ndarray,
    image_corners: np.ndarray,
    config: OverlayConfig | None = None,
) -> np.ndarray:
    """Return a copy of `frame` with the fretboard overlay drawn."""
    cfg = config or OverlayConfig()
    out = frame.copy()
    homography = fretboard_homography(image_corners)
    corners = np.asarray(image_corners, dtype=np.float32).reshape(4, 2)

    if cfg.draw_quad:
        _draw_polyline(out, corners, QUAD_COLOR, thickness=2, closed=True)
        nut = np.stack([corners[0], corners[3]])
        _draw_polyline(out, nut, NUT_COLOR, thickness=3, closed=False)

    if cfg.draw_grid:
        xs = normalized_fret_xs(cfg.visible_frets)
        for x in xs:
            line = canonical_to_image(
                np.array([[x, 0.0], [x, 1.0]], dtype=np.float32),
                homography,
            )
            _draw_polyline(out, line, GRID_COLOR, thickness=1)
        for i in range(cfg.num_strings + 1):
            y = i / cfg.num_strings
            line = canonical_to_image(
                np.array([[0.0, y], [1.0, y]], dtype=np.float32),
                homography,
            )
            _draw_polyline(out, line, GRID_COLOR, thickness=1)

    for string_number, fret in cfg.highlights:
        if not 1 <= string_number <= cfg.num_strings:
            continue
        if not 1 <= fret <= cfg.visible_frets:
            continue
        cell = canonical_to_image(
            cell_canonical_quad(
                string_number, fret, cfg.visible_frets, cfg.num_strings
            ),
            homography,
        )
        _blend_poly(out, cell, HIGHLIGHT_FILL, cfg.alpha)
        _draw_polyline(out, cell, HIGHLIGHT_FILL, thickness=1, closed=True)

        if cfg.draw_labels:
            center = canonical_to_image(
                cell_canonical_center(
                    string_number, fret, cfg.visible_frets, cfg.num_strings
                ).reshape(1, 2),
                homography,
            )[0]
            radius = max(8, int(round(np.linalg.norm(cell[0] - cell[1]) * 0.18)))
            cx, cy = int(round(center[0])), int(round(center[1]))
            cv2.circle(out, (cx, cy), radius, (30, 30, 30), -1, lineType=cv2.LINE_AA)
            cv2.circle(out, (cx, cy), radius, TEXT_COLOR, 1, lineType=cv2.LINE_AA)
            label = str(fret)
            font_scale = max(0.35, radius / 18.0)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
            cv2.putText(
                out,
                label,
                (cx - tw // 2, cy + th // 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                TEXT_COLOR,
                1,
                cv2.LINE_AA,
            )

    if cfg.label:
        cv2.putText(
            out,
            cfg.label,
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
    return out


def draw_hud(
    frame: np.ndarray,
    *,
    detector: str,
    tracked: bool,
    confidence: float | None,
    extra_lines: Iterable[str] = (),
) -> np.ndarray:
    """Draw a small status block in the lower-left, similar in spirit to the demo HUD."""
    out = frame.copy()
    lines = [
        f"detector: {detector}",
        f"lock: {'yes' if tracked else 'lost'}",
    ]
    if confidence is not None:
        lines.append(f"conf: {confidence:.2f}")
    lines.extend(extra_lines)
    x, y0 = 16, out.shape[0] - 18 * (len(lines) + 1)
    for i, line in enumerate(lines):
        cv2.putText(
            out,
            line,
            (x, y0 + i * 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (240, 240, 240),
            1,
            cv2.LINE_AA,
        )
    return out
