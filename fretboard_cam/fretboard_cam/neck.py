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


def _crop_from_box(
    frame: np.ndarray, box_xyxy: np.ndarray | None
) -> tuple[np.ndarray, np.ndarray] | None:
    if box_xyxy is None:
        return frame, np.array([0.0, 0.0], dtype=np.float32)
    x1, y1, x2, y2 = [int(round(v)) for v in box_xyxy]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(frame.shape[1] - 1, x2), min(frame.shape[0] - 1, y2)
    if x2 <= x1 + 16 or y2 <= y1 + 16:
        return None
    return frame[y1:y2, x1:x2], np.array([x1, y1], dtype=np.float32)


def _box_long_axis_angle(crop: np.ndarray) -> float | None:
    """Angle of a typical guitar in this crop: along the longer box side."""
    h, w = crop.shape[:2]
    if w >= h * 1.12:
        return 0.0
    if h >= w * 1.12:
        return 90.0
    return None


def _collect_segments(gray: np.ndarray, min_len: float) -> list[tuple[float, float, np.ndarray]]:
    segs: list[tuple[float, float, np.ndarray]] = []

    def _add(x_a: float, y_a: float, x_b: float, y_b: float) -> None:
        length = float(np.hypot(x_b - x_a, y_b - y_a))
        if length < min_len:
            return
        angle = float(np.degrees(np.arctan2(y_b - y_a, x_b - x_a)) % 180.0)
        segs.append((length, angle, np.array([x_a, y_a, x_b, y_b], dtype=np.float32)))

    lsd = cv2.createLineSegmentDetector()
    detected = lsd.detect(gray)[0]
    if detected is not None:
        for x_a, y_a, x_b, y_b in detected.reshape(-1, 4):
            _add(float(x_a), float(y_a), float(x_b), float(y_b))

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    edges = cv2.Canny(enhanced, 40, 120)
    hough = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=28,
        minLineLength=int(max(24, min_len)),
        maxLineGap=16,
    )
    if hough is not None:
        for x_a, y_a, x_b, y_b in hough.reshape(-1, 4):
            _add(float(x_a), float(y_a), float(x_b), float(y_b))
    return segs


def _dominant_angle(
    segs: list[tuple[float, float, np.ndarray]],
    prefer: float | None,
) -> float | None:
    if not segs:
        return None
    weights = np.zeros(36, dtype=np.float32)
    for length, angle, _ in segs:
        if prefer is not None and _angle_diff_deg(angle, prefer) > 50.0:
            continue
        boost = 1.0
        if prefer is not None:
            boost = 1.0 + 1.5 * (1.0 - _angle_diff_deg(angle, prefer) / 50.0)
        idx = min(35, int(angle / 5.0))
        weights[idx] += length * boost
    if float(weights.max()) <= 0:
        for length, angle, _ in segs:
            idx = min(35, int(angle / 5.0))
            weights[idx] += length
        if float(weights.max()) <= 0:
            return None
    return float((int(np.argmax(weights)) + 0.5) * 5.0)


def _merge_rails(
    parallel: list[tuple[float, float, np.ndarray]],
    long_axis: np.ndarray,
    short_axis: np.ndarray,
    bin_w: float = 6.0,
) -> list[dict[str, float]]:
    mids = np.stack([(s[2][:2] + s[2][2:]) / 2.0 for s in parallel])
    perp = mids @ short_axis
    order = np.argsort(perp)
    rails: list[dict[str, float]] = []
    i = 0
    while i < len(order):
        j = i
        ps = [float(perp[order[i]])]
        length_sum = parallel[order[i]][0]
        ts = [
            float(parallel[order[i]][2][:2] @ long_axis),
            float(parallel[order[i]][2][2:] @ long_axis),
        ]
        while j + 1 < len(order) and float(perp[order[j + 1]] - perp[order[i]]) <= bin_w:
            j += 1
            ps.append(float(perp[order[j]]))
            length_sum += parallel[order[j]][0]
            ts.append(float(parallel[order[j]][2][:2] @ long_axis))
            ts.append(float(parallel[order[j]][2][2:] @ long_axis))
        rails.append(
            {
                "p": float(np.mean(ps)),
                "t0": float(min(ts)),
                "t1": float(max(ts)),
                "L": float(length_sum),
            }
        )
        i = j + 1
    return rails


def _band_stats(
    value: np.ndarray,
    sat: np.ndarray,
    long_axis: np.ndarray,
    short_axis: np.ndarray,
    t: float,
    w0: float,
    w1: float,
    samples: int = 7,
) -> tuple[float, float]:
    h, w = value.shape[:2]
    ws = np.linspace(w0, w1, samples)
    xs = []
    ys = []
    for wv in ws:
        pt = t * long_axis + wv * short_axis
        xs.append(pt[0])
        ys.append(pt[1])
    xi = np.clip(np.round(xs).astype(int), 0, w - 1)
    yi = np.clip(np.round(ys).astype(int), 0, h - 1)
    return float(value[yi, xi].mean()), float(sat[yi, xi].mean())


def _is_fretboard_interior(vmean: float, smean: float) -> bool:
    """Maple / light wood: bright enough to not be a pickguard, not a lamp flare."""
    if vmean < 118.0 or vmean > 230.0:
        return False
    if smean < 16.0:
        return False
    return True


def _corners_from_axes(
    t0: float,
    t1: float,
    w0: float,
    w1: float,
    long_axis: np.ndarray,
    short_axis: np.ndarray,
    origin: np.ndarray,
) -> np.ndarray:
    corners_local = np.stack(
        [
            t0 * long_axis + w0 * short_axis,
            t1 * long_axis + w0 * short_axis,
            t1 * long_axis + w1 * short_axis,
            t0 * long_axis + w1 * short_axis,
        ]
    ).astype(np.float32)
    return order_fretboard_corners(corners_local + origin)


def neck_quad_from_lines(
    frame: np.ndarray,
    box_xyxy: np.ndarray | None = None,
    *,
    min_line_length: float | None = None,
) -> np.ndarray | None:
    """Fit a fretboard quad from parallel neck-edge / string lines.

    High-contrast pickguard strings often outvote the maple neck, so candidate
    bundles are scored by *interior brightness* (light wood, not a dark
    pickguard or blown-out lamp) and a plausible neck width. The YOLO guitar
    box's long axis is used as an angle prior so bookshelf edges lose.
    """
    cropped = _crop_from_box(frame, box_xyxy)
    if cropped is None:
        return None
    crop, origin = cropped

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    diag = float(np.hypot(crop.shape[1], crop.shape[0]))
    min_len = min_line_length if min_line_length is not None else max(18.0, 0.045 * diag)
    segs = _collect_segments(gray, min_len)
    if len(segs) < 2:
        return None

    prefer = _box_long_axis_angle(crop)
    dominant = _dominant_angle(segs, prefer)
    if dominant is None:
        return None

    parallel = [s for s in segs if _angle_diff_deg(s[1], dominant) <= 12.0]
    if len(parallel) < 2:
        return None

    theta = np.radians(dominant)
    long_axis = np.array([np.cos(theta), np.sin(theta)], dtype=np.float32)
    short_axis = np.array([-np.sin(theta), np.cos(theta)], dtype=np.float32)
    rails = _merge_rails(parallel, long_axis, short_axis)
    if len(rails) < 2:
        return None

    if crop.ndim == 3:
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        value = hsv[:, :, 2].astype(np.float32)
        sat = hsv[:, :, 1].astype(np.float32)
    else:
        value = gray.astype(np.float32)
        sat = np.full_like(value, 80.0)

    min_w = max(32.0, 0.06 * min(crop.shape[:2]))
    max_w = max(min_w + 16.0, 0.26 * min(crop.shape[:2]))
    best: tuple[float, dict[str, float], dict[str, float], float, float] | None = None

    for i, rail_a in enumerate(rails):
        for rail_b in rails[i + 1 :]:
            width = float(rail_b["p"] - rail_a["p"])
            if not (min_w <= width <= max_w):
                continue
            overlap_t0 = max(rail_a["t0"], rail_b["t0"])
            overlap_t1 = min(rail_a["t1"], rail_b["t1"])
            overlap = overlap_t1 - overlap_t0
            if overlap >= 48:
                t0, t1 = overlap_t0, overlap_t1
            else:
                t0 = min(rail_a["t0"], rail_b["t0"])
                t1 = max(rail_a["t1"], rail_b["t1"])
            span = t1 - t0
            if span < 80:
                continue
            aspect = span / max(width, 1.0)
            if aspect < 3.0:
                continue
            inset = 0.16 * width
            ts = np.linspace(t0 + 0.08 * span, t1 - 0.08 * span, 28)
            ok_v: list[float] = []
            ok_s: list[float] = []
            ok_t: list[float] = []
            for t in ts:
                vmean, smean = _band_stats(
                    value,
                    sat,
                    long_axis,
                    short_axis,
                    float(t),
                    rail_a["p"] + inset,
                    rail_b["p"] - inset,
                )
                if _is_fretboard_interior(vmean, smean):
                    ok_v.append(vmean)
                    ok_s.append(smean)
                    ok_t.append(float(t))
            # Strings continue onto the pickguard, so the full-span mean is dark.
            # Keep pairs that have a long enough maple stretch.
            if len(ok_v) < 8:
                continue
            vmean = float(np.mean(ok_v))
            smean = float(np.mean(ok_s))
            maple_span = float(max(ok_t) - min(ok_t)) if len(ok_t) >= 2 else 0.0
            maple_aspect = maple_span / max(width, 1.0)
            if maple_aspect < 2.8:
                continue
            inner = sum(1 for r in rails if rail_a["p"] < r["p"] < rail_b["p"])
            mid_t = float(np.median(np.asarray(ok_t)))
            mid_w = 0.5 * (rail_a["p"] + rail_b["p"])
            mid_xy = mid_t * long_axis + mid_w * short_axis
            left_bonus = 35.0 * (1.0 - float(mid_xy[0]) / max(crop.shape[1], 1))
            top_bonus = 0.0
            if crop.shape[1] >= crop.shape[0] * 1.12:
                top_bonus = 55.0 * (1.0 - float(mid_xy[1]) / max(crop.shape[0], 1))
            score = (
                width * 1.6
                + min(maple_aspect, 14.0) * 10.0
                + 0.2 * vmean
                + 0.012 * (rail_a["L"] + rail_b["L"])
                + 8.0 * min(inner, 6)
                + left_bonus
                + top_bonus
            )
            if 140.0 <= vmean <= 190.0:
                score += 20.0
            if best is None or score > best[0]:
                best = (score, rail_a, rail_b, t0, t1)

    if best is not None:
        _score, rail_a, rail_b, t0, t1 = best
        width = float(rail_b["p"] - rail_a["p"])
        inset = 0.10 * width
        w0 = float(rail_a["p"] + inset)
        w1 = float(rail_b["p"] - inset)
        scan_inset = 0.22 * width
        sw0 = float(rail_a["p"] + scan_inset)
        sw1 = float(rail_b["p"] - scan_inset)
        if sw1 <= sw0:
            sw0, sw1 = w0, w1
        # Rails often continue onto the pickguard. Keep the longest maple run.
        endpoints = np.concatenate(
            [np.stack([s[2][:2] for s in parallel]), np.stack([s[2][2:] for s in parallel])]
        )
        t_scan0 = float((endpoints @ long_axis).min())
        t_scan1 = float((endpoints @ long_axis).max())
        step = 8.0
        ts = np.arange(t_scan0, t_scan1 + step, step)
        flags = []
        for t in ts:
            vmean, smean = _band_stats(value, sat, long_axis, short_axis, float(t), sw0, sw1)
            flags.append(_is_fretboard_interior(vmean, smean))
        # Frets and fingers punch small holes; keep one run for the whole neck.
        flags_arr = np.asarray(flags, dtype=bool)
        for i in range(1, len(flags_arr) - 1):
            if flags_arr[i - 1] and flags_arr[i + 1]:
                flags_arr[i] = True
        for i in range(2, len(flags_arr) - 2):
            if flags_arr[i - 2] and flags_arr[i + 2]:
                flags_arr[i] = True
        run = _longest_true_run(flags_arr)
        if run is not None and (run[1] - run[0]) >= 6:
            t0 = float(ts[run[0]])
            t1 = float(ts[min(run[1] - 1, len(ts) - 1)])
        trim = 0.04 * max(t1 - t0, 1.0)
        t0 += trim
        t1 -= trim
        if t1 > t0:
            return _corners_from_axes(t0, t1, w0, w1, long_axis, short_axis, origin)

    return _neck_quad_from_line_envelope(parallel, long_axis, short_axis, crop, origin)


def _neck_quad_from_line_envelope(
    parallel: list[tuple[float, float, np.ndarray]],
    long_axis: np.ndarray,
    short_axis: np.ndarray,
    crop: np.ndarray,
    origin: np.ndarray,
) -> np.ndarray | None:
    """Legacy fallback: densest parallel bundle when wood scoring finds nothing."""
    mids = np.stack([(s[2][:2] + s[2][2:]) / 2.0 for s in parallel])
    lengths_arr = np.asarray([s[0] for s in parallel], dtype=np.float32)
    perp = mids @ short_axis
    span = float(perp.max() - perp.min())
    if span < 4:
        return None
    endpoints = np.concatenate(
        [np.stack([s[2][:2] for s in parallel]), np.stack([s[2][2:] for s in parallel])]
    )
    t_all = endpoints @ long_axis
    length_all = float(t_all.max() - t_all.min())
    aspect = length_all / max(span, 1.0)
    use_all = 3.0 <= aspect <= 18.0 and span <= 0.28 * min(crop.shape[0], crop.shape[1])
    if use_all:
        pts_arr = endpoints
    else:
        neck_width_guess = float(
            np.clip(0.16 * min(crop.shape[0], crop.shape[1]), 28.0, span)
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
        bundle_idx = [k for k, p in enumerate(perp) if best_lo - 2 <= p <= best_hi + 2]
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
    return _corners_from_axes(t0, t1, w0, w1, long_axis, short_axis, origin)


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
