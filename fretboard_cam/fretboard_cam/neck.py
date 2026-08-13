"""Isolate a guitar neck as a quadrilateral from a box or mask."""

from __future__ import annotations

import cv2
import numpy as np

from .geometry import order_fretboard_corners


def _longest_true_run(flags: np.ndarray) -> tuple[int, int] | None:
    best: tuple[int, int] | None = None
    start = None
    for i, flag in enumerate(list(flags) + [False]):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            run = (start, i)
            if best is None or (run[1] - run[0]) > (best[1] - best[0]):
                best = run
            start = None
    return best


def _angle_diff_deg(a: float, b: float) -> float:
    delta = abs(a - b) % 180.0
    return min(delta, 180.0 - delta)


def neck_quad_from_lines(
    frame: np.ndarray,
    box_xyxy: np.ndarray | None = None,
    *,
    min_line_length: float | None = None,
) -> np.ndarray | None:
    """Fit a fretboard quad from the densest bundle of long parallel lines.

    Guitar strings (and neck edges) are a tight cluster of long segments
    that share one angle. Frets are shorter and perpendicular, so they
    lose the length-weighted vote.
    """
    if box_xyxy is not None:
        x1, y1, x2, y2 = [int(round(v)) for v in box_xyxy]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame.shape[1] - 1, x2), min(frame.shape[0] - 1, y2)
        if x2 <= x1 + 16 or y2 <= y1 + 16:
            return None
        crop = frame[y1:y2, x1:x2]
        origin = np.array([x1, y1], dtype=np.float32)
    else:
        crop = frame
        origin = np.array([0.0, 0.0], dtype=np.float32)

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    lsd = cv2.createLineSegmentDetector()
    detected = lsd.detect(gray)[0]
    if detected is None:
        return None
    lines = detected.reshape(-1, 4).astype(np.float32)
    if lines.shape[0] < 2:
        return None

    diag = float(np.hypot(crop.shape[1], crop.shape[0]))
    min_len = min_line_length if min_line_length is not None else max(18.0, 0.045 * diag)

    segs: list[tuple[float, float, np.ndarray]] = []
    for x_a, y_a, x_b, y_b in lines:
        length = float(np.hypot(x_b - x_a, y_b - y_a))
        if length < min_len:
            continue
        angle = float(np.degrees(np.arctan2(y_b - y_a, x_b - x_a)) % 180.0)
        segs.append((length, angle, np.array([x_a, y_a, x_b, y_b], dtype=np.float32)))
    if len(segs) < 2:
        return None

    weights = np.zeros(36, dtype=np.float32)
    for length, angle, _ in segs:
        idx = min(35, int(angle / 5.0))
        weights[idx] += length
    dominant = float((int(np.argmax(weights)) + 0.5) * 5.0)

    parallel = [s for s in segs if _angle_diff_deg(s[1], dominant) <= 12.0]
    if len(parallel) < 2:
        return None

    theta = np.radians(dominant)
    long_axis = np.array([np.cos(theta), np.sin(theta)], dtype=np.float32)
    short_axis = np.array([-np.sin(theta), np.cos(theta)], dtype=np.float32)

    mids = []
    lengths = []
    for length, _, coords in parallel:
        a = coords[:2]
        b = coords[2:]
        mids.append((a + b) / 2.0)
        lengths.append(length)
    mids_arr = np.stack(mids)
    lengths_arr = np.asarray(lengths, dtype=np.float32)
    perp = mids_arr @ short_axis

    span = float(perp.max() - perp.min())
    if span < 4:
        return None

    endpoints = np.concatenate(
        [np.stack([s[2][:2] for s in parallel]), np.stack([s[2][2:] for s in parallel])]
    )
    t_all = endpoints @ long_axis
    length_all = float(t_all.max() - t_all.min())
    aspect = length_all / max(span, 1.0)

    use_all = 3.0 <= aspect <= 18.0 and span <= 0.45 * min(crop.shape[0], crop.shape[1])
    if use_all:
        pts_arr = endpoints
    else:
        neck_width_guess = float(
            np.clip(0.28 * min(crop.shape[0], crop.shape[1]), 16.0, span)
        )
        order = np.argsort(perp)
        perp_sorted = perp[order]
        len_sorted = lengths_arr[order]
        best_score = -1.0
        best_lo = float(perp.min())
        best_hi = float(perp.max())
        j = 0
        for i in range(len(perp_sorted)):
            while (
                j < len(perp_sorted)
                and perp_sorted[j] - perp_sorted[i] <= neck_width_guess
            ):
                j += 1
            score = float(len_sorted[i:j].sum())
            if score > best_score:
                best_score = score
                best_lo = float(perp_sorted[i])
                best_hi = float(perp_sorted[j - 1])

        bundle_idx = [
            k for k, p in enumerate(perp) if best_lo - 2 <= p <= best_hi + 2
        ]
        if len(bundle_idx) < 2:
            return None
        pts = []
        for k in bundle_idx:
            pts.append(parallel[k][2][:2])
            pts.append(parallel[k][2][2:])
        pts_arr = np.stack(pts)
    t = pts_arr @ long_axis
    w = pts_arr @ short_axis
    t0, t1 = float(t.min()), float(t.max())
    w0, w1 = float(w.min()), float(w.max())
    trim = 0.06 * (t1 - t0)
    t0 += trim
    t1 -= trim
    if t1 <= t0:
        return None

    corners_local = np.stack(
        [
            t0 * long_axis + w0 * short_axis,
            t1 * long_axis + w0 * short_axis,
            t1 * long_axis + w1 * short_axis,
            t0 * long_axis + w1 * short_axis,
        ]
    ).astype(np.float32)
    return order_fretboard_corners(corners_local + origin)


def neck_quad_from_mask(
    mask: np.ndarray,
    *,
    width_ratio: float = 0.42,
    min_bins: int = 8,
) -> np.ndarray | None:
    """Return an ordered fretboard quad from a binary guitar mask.

    Walks along the mask's long axis and keeps the longest run of *thin*
    slices. That run is the neck; the body is the sudden wide section.
    """
    binary = (mask > 0).astype(np.uint8)
    ys, xs = np.nonzero(binary)
    if xs.size < 200:
        return None

    pts = np.column_stack([xs.astype(np.float32), ys.astype(np.float32)])
    mean = pts.mean(axis=0)
    centered = pts - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    long_axis = eigvecs[:, int(np.argmax(eigvals))]
    short_axis = eigvecs[:, int(np.argmin(eigvals))]

    t = centered @ long_axis
    w = centered @ short_axis
    t_min, t_max = float(t.min()), float(t.max())
    if t_max - t_min < 20:
        return None

    n_bins = 48
    edges = np.linspace(t_min, t_max, n_bins + 1)
    widths = np.zeros(n_bins, dtype=np.float32)
    counts = np.zeros(n_bins, dtype=np.int32)
    for i in range(n_bins):
        sel = (t >= edges[i]) & (t < edges[i + 1])
        counts[i] = int(sel.sum())
        if counts[i] >= 8:
            widths[i] = float(w[sel].max() - w[sel].min())

    valid = widths > 0
    if int(valid.sum()) < min_bins:
        return None
    max_w = float(widths[valid].max())
    median_w = float(np.median(widths[valid]))
    threshold = max(max_w * width_ratio, median_w * 0.9)
    thin = valid & (widths <= threshold)
    run = _longest_true_run(thin)
    if run is None or (run[1] - run[0]) < min_bins:
        mid = (t_min + t_max) / 2.0
        left_w = float(np.median(widths[valid][: max(1, n_bins // 2)]))
        right_w = float(np.median(widths[valid][n_bins // 2 :]))
        if left_w <= right_w:
            neck_sel = t <= mid
        else:
            neck_sel = t >= mid
    else:
        neck_sel = (t >= edges[run[0]]) & (t < edges[run[1]])

    neck_pts = pts[neck_sel]
    if neck_pts.shape[0] < 80:
        return None

    neck_centered = neck_pts - neck_pts.mean(axis=0)
    neck_t = neck_centered @ long_axis
    end_frac = max(4, int(0.08 * neck_pts.shape[0]))
    nut_side = neck_pts[np.argsort(neck_t)[:end_frac]]
    body_side = neck_pts[np.argsort(neck_t)[-end_frac:]]

    def _end_corners(end_pts: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        local = (end_pts - mean) @ short_axis
        lo = end_pts[int(np.argmin(local))]
        hi = end_pts[int(np.argmax(local))]
        return lo, hi

    nut_a, nut_b = _end_corners(nut_side)
    body_a, body_b = _end_corners(body_side)
    quad = np.stack([nut_a, body_a, body_b, nut_b]).astype(np.float32)
    return order_fretboard_corners(quad)
