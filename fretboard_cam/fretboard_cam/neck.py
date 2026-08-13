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


def _expand_box(
    frame: np.ndarray, box_xyxy: np.ndarray | None, *, left: float = 0.38
) -> np.ndarray | None:
    """Pad a YOLO guitar box left/vertically so the headstock is not clipped."""
    h, w = frame.shape[:2]
    if box_xyxy is None:
        return None
    x1, y1, x2, y2 = [int(round(v)) for v in box_xyxy]
    bw = max(x2 - x1, 1)
    bh = max(y2 - y1, 1)
    x1 = max(0, x1 - int(left * bw))
    x2 = min(w - 1, x2 + int(0.05 * bw))
    y1 = max(0, y1 - int(0.24 * bh))
    y2 = min(h - 1, y2 + int(0.24 * bh))
    if x2 <= x1 + 16 or y2 <= y1 + 16:
        return None
    return np.array([x1, y1, x2, y2], dtype=np.float32)


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


def _fill_1d_holes(flags: np.ndarray, radius: int = 2) -> np.ndarray:
    out = flags.copy()
    for _ in range(radius):
        nxt = out.copy()
        for i in range(1, len(out) - 1):
            if out[i - 1] and out[i + 1]:
                nxt[i] = True
        out = nxt
    return out


def _ridge_response(val: np.ndarray, sat: np.ndarray, hw: int, flank: int) -> np.ndarray:
    """Bright band with a darker underside (maple neck on a black shirt)."""
    k_in = np.ones((2 * hw, 1), np.float32) / float(2 * hw)
    inside = cv2.filter2D(val, -1, k_in, borderType=cv2.BORDER_REPLICATE)
    k_f = np.ones((flank, 1), np.float32) / float(flank)
    flank_mean = cv2.filter2D(val, -1, k_f, borderType=cv2.BORDER_REPLICATE)
    shift = hw + flank // 2
    above = np.roll(flank_mean, -shift, axis=0)
    below = np.roll(flank_mean, shift, axis=0)
    ridge = (inside - below) + 0.4 * np.maximum(inside - above, 0.0)
    ridge = np.maximum(ridge, 0.0)
    ridge[: shift + 2] = 0
    ridge[-(shift + 2) :] = 0
    maple = ((sat >= 16) & (sat <= 145) & (val >= 125)).astype(np.float32)
    ridge *= 0.22 + 0.78 * cv2.blur(maple, (17, 9))
    return ridge


def _expand_plateau(
    col: np.ndarray, y_mid: int, min_w: int, max_w: int
) -> tuple[int, int] | None:
    """Grow from a centerline pixel to the bright-wood plateau, ignoring thin strings."""
    h = int(col.shape[0])
    y_mid = int(np.clip(y_mid, 1, h - 2))
    peak_v = float(col[y_mid])
    thresh = max(128.0, peak_v - 70.0)
    bright = _fill_1d_holes(col > thresh, radius=2)
    if not bright[y_mid]:
        found = None
        for d in range(1, max(10, min_w // 2)):
            if y_mid - d >= 0 and bright[y_mid - d]:
                found = y_mid - d
                break
            if y_mid + d < h and bright[y_mid + d]:
                found = y_mid + d
                break
        if found is None:
            return None
        y_mid = found
        peak_v = float(col[y_mid])
        thresh = max(128.0, peak_v - 70.0)
        bright = _fill_1d_holes(col > thresh, radius=2)
    y_top = y_mid
    y_bot = y_mid
    limit_t = max(1, y_mid - max_w)
    limit_b = min(h - 2, y_mid + max_w)
    while y_top > limit_t and bright[y_top - 1]:
        y_top -= 1
    while y_bot < limit_b and bright[y_bot + 1]:
        y_bot += 1
    if (y_bot - y_top) < min_w:
        return None
    return y_top, y_bot


def _theil_sen(xs: np.ndarray, ys: np.ndarray) -> tuple[float, float]:
    """Robust y = slope * x + intercept."""
    n = len(xs)
    slopes: list[float] = []
    step = 1 if n < 40 else 2
    for i in range(0, n - 1, step):
        for j in range(i + step, n, step):
            dx = float(xs[j] - xs[i])
            if abs(dx) < 8:
                continue
            slopes.append(float(ys[j] - ys[i]) / dx)
    if not slopes:
        slope = 0.0
    else:
        slope = float(np.median(np.asarray(slopes)))
    intercept = float(np.median(ys - slope * xs))
    return slope, intercept


def _fit_quad_from_bands(
    xs: np.ndarray,
    tops: np.ndarray,
    bots: np.ndarray,
    origin: np.ndarray,
    min_span: float,
    val: np.ndarray | None = None,
    sat: np.ndarray | None = None,
) -> np.ndarray | None:
    if len(xs) < 10:
        return None
    widths = bots - tops
    med_w = float(np.median(widths))
    ok = np.abs(widths - med_w) < 0.45 * max(med_w, 1.0)
    ok = _fill_1d_holes(ok, radius=2)
    run = _longest_true_run(ok)
    if run is None or (run[1] - run[0]) < 8:
        return None
    sl = slice(run[0], run[1])
    xs, tops, bots = xs[sl], tops[sl], bots[sl]
    if float(xs.max() - xs.min()) < min_span:
        return None
    mids = 0.5 * (tops + bots)
    # Prefer the outer neck edges, not an inner string pair.
    widths = bots - tops
    med_w = float(np.percentile(widths, 72))
    slope, intercept = _theil_sen(xs, mids)
    # Dark-below matching sits a little low; nudge onto the maple.
    intercept -= 0.12 * med_w
    x0, x1 = float(xs.min()), float(xs.max())
    if val is not None and sat is not None:
        crop_h, crop_w = val.shape[:2]
        misses = 0
        x_scan = x1
        x_limit = min(float(crop_w - 4), x1 + 0.45 * crop_w)
        while x_scan + 4 <= x_limit:
            x_scan += 4
            y_mid = intercept + slope * x_scan
            yi = int(np.clip(round(y_mid), 2, crop_h - 3))
            xi = int(np.clip(x_scan, 0, crop_w - 1))
            band_t = int(np.clip(yi - 0.45 * med_w, 0, crop_h - 1))
            band_b = int(np.clip(yi + 0.45 * med_w, 0, crop_h - 1))
            if band_b <= band_t + 4:
                break
            interior = float(val[band_t:band_b, xi].mean())
            smean = float(sat[band_t:band_b, xi].mean())
            if interior < 128 or smean > 150:
                misses += 1
                if misses >= 4:
                    break
                continue
            misses = 0
            x1 = x_scan
    pad = 0.008 * max(x1 - x0, 1.0)
    x0 += pad
    x1 -= pad
    if x1 <= x0:
        return None
    # Offset along image-y is fine for near-horizontal necks; correct a bit for slope.
    half = 0.5 * med_w
    denom = float(np.hypot(slope, 1.0))
    dy = half / denom
    dx = -slope * dy
    mid0 = intercept + slope * x0
    mid1 = intercept + slope * x1
    quad = np.array(
        [
            [x0 - dx, mid0 + dy],
            [x1 - dx, mid1 + dy],
            [x1 + dx, mid1 - dy],
            [x0 + dx, mid0 - dy],
        ],
        dtype=np.float32,
    )
    return order_fretboard_corners(quad + origin)


def neck_quad_from_ridge(
    frame: np.ndarray,
    box_xyxy: np.ndarray | None = None,
) -> np.ndarray | None:
    """Fit a fretboard quad to a bright maple ridge sitting on a dark shirt.

    YOLO's guitar box often covers the whole instrument and clips the
    headstock, so the search region is expanded left. A matched filter finds
    the chest-height ridge, then the centerline is tracked along x so a tilted
    neck is followed out to the pickguard.
    """
    expanded = _expand_box(frame, box_xyxy) if box_xyxy is not None else None
    cropped = _crop_from_box(frame, expanded)
    if cropped is None:
        return None
    crop, origin = cropped
    if crop.shape[0] < 40 or crop.shape[1] < 80:
        return None

    h_full, w_full = frame.shape[:2]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV) if crop.ndim == 3 else None
    if hsv is None:
        val = crop.astype(np.float32)
        sat = np.full_like(val, 70.0)
    else:
        val = hsv[:, :, 2].astype(np.float32)
        sat = hsv[:, :, 1].astype(np.float32)
    vsm = cv2.GaussianBlur(val, (5, 7), 0)
    ch, cw = val.shape
    hw = max(22, int(0.055 * h_full))
    flank = max(16, int(0.032 * h_full))
    ridge = _ridge_response(val, sat, hw, flank)

    x_lo_s = int(0.05 * cw)
    x_hi_s = int(0.58 * cw)
    if x_hi_s <= x_lo_s + 16:
        x_lo_s, x_hi_s = 0, cw
    kxw = max(21, int(0.14 * cw) | 1)
    horiz = cv2.blur(ridge, (kxw, 1))
    horiz = cv2.GaussianBlur(horiz, (1, 9), 0)
    row_score = np.percentile(horiz[:, x_lo_s:x_hi_s], 80, axis=1)
    y0, y1 = int(0.28 * ch), int(0.78 * ch)
    if y1 <= y0 + 8:
        return None
    y_peak = y0 + int(np.argmax(row_score[y0:y1]))
    peak = float(row_score[y_peak])
    if peak < 5.0:
        return None

    seed_band = ridge[max(0, y_peak - 10) : min(ch, y_peak + 11), x_lo_s:x_hi_s]
    if seed_band.size == 0:
        return None
    seed_x = x_lo_s + int(np.argmax(seed_band.max(axis=0)))
    shift = hw + flank // 2
    win = max(28, int(0.09 * h_full))
    min_w = max(22, int(0.048 * h_full))
    max_w = max(min_w + 8, int(0.22 * h_full))

    def _walk(x_start: int, y_start: float, x_end: int, step: int) -> list[tuple[int, int, int]]:
        pts: list[tuple[int, int, int]] = []
        pred = float(y_start)
        misses = 0
        x = x_start
        while (step > 0 and x <= x_end) or (step < 0 and x >= x_end):
            y_a = int(np.clip(pred - win, shift + 2, ch - shift - 6))
            y_b = int(np.clip(pred + win, y_a + 6, ch - shift - 3))
            strip = ridge[y_a:y_b, x]
            y_loc = y_a + int(np.argmax(strip))
            strength = float(strip.max())
            y_for_band = y_loc if strength >= 7 else int(round(pred))
            expanded = _expand_plateau(vsm[:, x], y_for_band, min_w, max_w)
            if expanded is None:
                if strength >= 7:
                    pred = 0.7 * pred + 0.3 * y_loc
                misses += 1
                if misses >= 16:
                    break
                x += step
                continue
            y_top, y_bot = expanded
            interior = float(vsm[y_top:y_bot, x].mean())
            smean = float(sat[y_top:y_bot, x].mean())
            # Pickguard / body: dark or very saturated butterscotch.
            if interior < 122 or smean > 152:
                if strength >= 7:
                    pred = 0.7 * pred + 0.3 * y_loc
                misses += 1
                if misses >= 7 and pts:
                    break
                x += step
                continue
            misses = 0
            pred = 0.55 * pred + 0.45 * (0.5 * (y_top + y_bot))
            pts.append((x, y_top, y_bot))
            x += step
        return pts

    right = _walk(seed_x, float(y_peak), cw - 4, 3)
    left = _walk(seed_x - 3, float(y_peak), 3, -3)
    samples = list(reversed(left)) + right
    if len(samples) < 14:
        return None
    xs = np.array([p[0] for p in samples], dtype=np.float32)
    tops = np.array([p[1] for p in samples], dtype=np.float32)
    bots = np.array([p[2] for p in samples], dtype=np.float32)
    mids = 0.5 * (tops + bots)
    near = np.abs(mids - float(y_peak)) < 0.16 * ch
    if int(near.sum()) >= 12:
        xs, tops, bots = xs[near], tops[near], bots[near]
        samples = [p for p, keep in zip(samples, near) if keep]
    mids = 0.5 * (tops + bots)
    slope, intercept = _theil_sen(xs, mids)
    med_w = float(np.median(bots - tops))
    extra: list[tuple[int, int, int]] = []
    misses = 0
    x_right = int(xs.max())
    for x in range(x_right + 3, min(cw - 4, x_right + int(0.42 * cw)), 3):
        y_mid = int(round(intercept + slope * x))
        expanded = _expand_plateau(vsm[:, x], y_mid, min_w, max_w)
        if expanded is None:
            misses += 1
            if misses >= 8:
                break
            continue
        y_top, y_bot = expanded
        interior = float(vsm[y_top:y_bot, x].mean())
        smean = float(sat[y_top:y_bot, x].mean())
        width = float(y_bot - y_top)
        if interior < 125 or smean > 150 or abs(width - med_w) > 0.5 * max(med_w, 1.0):
            misses += 1
            if misses >= 5:
                break
            continue
        misses = 0
        extra.append((x, y_top, y_bot))
    if extra:
        samples = samples + extra
        xs = np.array([p[0] for p in samples], dtype=np.float32)
        tops = np.array([p[1] for p in samples], dtype=np.float32)
        bots = np.array([p[2] for p in samples], dtype=np.float32)
    return _fit_quad_from_bands(
        xs, tops, bots, origin, min_span=max(100.0, 0.10 * w_full), val=vsm, sat=sat
    )


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
