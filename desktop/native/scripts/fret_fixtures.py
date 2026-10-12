"""Generate Tests/FretCoreTests/Fixtures/gro_reference.json from the Python reference (gro, guitar-overlay repo).

    PYTHONPATH=/path/to/guitar-overlay/src python3 desktop/native/scripts/fret_fixtures.py

Needs numpy + opencv-python + gro. The Swift tests rebuild the same synthetic inputs and compare.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from gro.anchors import Anchor
from gro.board_end import FretCountVote, frame_last_fret, ridge_scores
from gro.geometry import FretboardModel, dlt, fit_fretboard, fret_u, plane_point
from gro.smooth import OneEuroModel

OUT = Path(__file__).resolve().parents[1] / "Tests/FretCoreTests/Fixtures/gro_reference.json"
TAU = 0.3


def synth_anchors(H, frets, noise, rng):
    m = FretboardModel(H, TAU)
    out = []
    for f in frets:
        for s, side in enumerate(("bass", "treble")):
            x, y = m.project_fy(f, float(s))
            out.append(Anchor(f, side, float(x + rng.normal(0, noise)), float(y + rng.normal(0, noise)),
                              conf=float(rng.uniform(0.6, 0.99))))
    return out


def ridge_image(H, w, h, last=22):
    """Dark board with bright fret wires 0..last (same formula as the Swift test)."""
    Hi = np.linalg.inv(H)
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    q = np.stack([xs.ravel(), ys.ravel(), np.ones(w * h)])
    p = Hi @ q
    u, Y = p[0] / p[2], p[1] / p[2]
    with np.errstate(all="ignore"):
        yc = Y / (1 + TAU * u) + 0.5
        fret = -12 * np.log2(1 - u)
    near = np.abs(fret - np.round(fret)) < 0.08
    wire = near & (np.round(fret) <= last) & (yc > -0.2) & (yc < 1.2) & (u < 1)
    board = (yc > -0.2) & (yc < 1.2) & (u < 1)
    img = np.where(wire, 200, np.where(board, 60, 30)).astype(np.uint8)
    return img.reshape(h, w)


def main():
    rng = np.random.default_rng(7)
    out = {}

    # 1. fit_fretboard with noise + outliers
    H = np.array([[1100.0, 30.0, 80.0], [40.0, 160.0, 300.0], [0.15, 0.05, 1.0]])
    anchors = synth_anchors(H, list(range(0, 16)), 0.5, rng)
    anchors[5] = Anchor(anchors[5].fret, anchors[5].side, anchors[5].x + 60, anchors[5].y - 25, conf=0.9)
    anchors[12] = Anchor(anchors[12].fret, anchors[12].side, anchors[12].x - 40, anchors[12].y + 30, conf=0.8)
    m = fit_fretboard(anchors)
    out["fit"] = {
        "H_true": (H / H[2, 2]).ravel().tolist(),
        "anchors": [[a.fret, 0 if a.side == "bass" else 1, a.x, a.y, a.conf] for a in anchors],
        "H_py": m.H.ravel().tolist(),
        "rmse_py": m.rmse_px,
        "n_inliers": len(m.inliers),
    }

    # 2. ridge scores on a synthetic 22-fret board
    Hr = np.array([[900.0, 0.0, -200.0], [0.0, 120.0, 180.0], [0.1, 0.0, 1.0]])
    img = ridge_image(Hr, 640, 360)
    model = FretboardModel(Hr / Hr[2, 2], TAU)
    rs = ridge_scores(img, model)
    out["ridge"] = {
        "H": (Hr / Hr[2, 2]).ravel().tolist(),
        "width": 640,
        "height": 360,
        "scores": {str(k): float(v) for k, v in rs.items()},
        "last": frame_last_fret(rs),
    }

    # 3. OneEuro over a noisy, moving sequence
    eu = OneEuroModel(30.0)
    frames, outs = [], []
    t = 0.0
    for i in range(40):
        Hi = H.copy()
        Hi[0, 2] += 3.0 * i if i > 20 else 0.0
        Hi[:2] += rng.normal(0, 0.4, (2, 3)) * np.array([1, 1, 1.0])
        dt = 1 / 30 if i % 7 else 2 / 30
        t += dt
        mi = FretboardModel(Hi / Hi[2, 2], TAU, 22)
        r = eu.update(mi, (720, 1280), dt if i else None)
        frames.append({"H": mi.H.ravel().tolist(), "dt": dt if i else None})
        outs.append(r.H.ravel().tolist())
    out["euro"] = {"fps": 30.0, "nFrets": 22, "width": 1280, "height": 720, "frames": frames, "out": outs}

    # 4. FretCountVote: estimates + confidence caps
    v = FretCountVote()
    seq = []
    for i in range(80):
        est = [None, 22, 22, 21, 22, 24][i % 6] if i > 3 else None
        conf = np.zeros(25)
        conf[: (21 if i < 30 else 23)] = 0.9
        if i % 9 == 0:
            conf[:] = 0.2
        v.update(est)
        v.observe_conf(conf)
        seq.append({"estimate": est, "conf": conf.tolist(), "value": v.value, "shown": v.shown, "settled": v.settled})
    out["vote"] = seq

    # 5. DLT exact recovery
    src = plane_point(fret_u(np.array([0, 0, 5, 5, 12, 12, 19, 19.0])), np.array([0, 1, 0, 1, 0, 1, 0, 1.0]), TAU)
    dst = (src @ H[:, :2].T + H[:, 2])
    dst = dst[:, :2] / dst[:, 2:]
    out["dlt"] = {"src": src.tolist(), "dst": dst.tolist(), "H_py": dlt(src, dst).ravel().tolist()}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out))
    print(OUT, OUT.stat().st_size, "bytes", "ridge", rs, "last", out["ridge"]["last"])


if __name__ == "__main__":
    main()
