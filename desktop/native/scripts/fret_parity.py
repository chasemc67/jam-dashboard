"""Parity + latency: Python gro FretboardTracker (reference) vs the Swift FretTrackerCLI helper over its stdin protocol.

Run on a Mac (needs gro, opencv-python and coremltools):

    PYTHONPATH=/path/to/guitar-overlay/src python desktop/native/scripts/fret_parity.py \
        --helper desktop/native/dist/FretTrackerCLI --mlmodelc desktop/native/dist/FretTrackerV1.mlmodelc \
        --mlpackage v1_fp16.mlpackage \
        --clip 0906:clips/2026-09-06_09-00-01.mp4:20:300:mirrored:24 \
        --clip stan:clips/stan_head3s.mp4:0:300:mirrored:22 \
        --clip nBpe2:clips/yt_nBpe2YQEzZo.mp4:10:300::22 --out out/parity.json

--clip label:path:start_s:n_frames:[mirrored]:frets. Every clip runs twice: frets voted (board-end ridge test on;
Python samples the full-res frame, Swift the 640 letterbox) and frets fixed to the given count (ridge test off, so the
remaining difference is model numerics + RANSAC RNG + smoothing).

Both sides run the same fp16 CoreML model (compute units ALL) on the same letterboxed frame, so keypoints should agree
to fp16/ANE noise. Expected differences: RANSAC samples (numpy RNG vs SplitMix64) -> slightly different inlier sets on
noisy frames; cv2.remap fixed point vs Swift bilinear; ridge test on the 640 letterbox instead of the full-res frame
(-> different end estimates / vote timing / capped nFrets during startup).
"""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np

from gro.infer import FretboardTracker
from gro.infer.preprocess import Letterbox

MAGIC = b"FRT1"
HEADER = struct.Struct("<4sIdIIII")


def stats(v):
    v = np.asarray([x for x in v if x is not None and np.isfinite(x)], float)
    if not len(v):
        return None
    return {"n": int(len(v)), "mean": float(v.mean()), "median": float(np.median(v)),
            "p95": float(np.percentile(v, 95)), "max": float(v.max())}


class Helper:
    def __init__(self, helper, mlmodelc, frets=None, compute_units="all"):
        cmd = [helper, "--model", mlmodelc, "--compute-units", compute_units, "--emit-kpts"]
        if frets:
            cmd += ["--frets", str(frets)]
        self.p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=0)
        self.ready = json.loads(self.p.stdout.readline())
        assert self.ready["type"] == "ready", self.ready

    def frame(self, fid, t, canon_bgr, src_w, src_h, mirrored, reset=False):
        lb = Letterbox.for_shape(canon_bgr.shape, 640)
        rgba = cv2.cvtColor(lb.apply(canon_bgr), cv2.COLOR_BGR2RGBA)
        payload = np.ascontiguousarray(rgba).tobytes()
        flags = (1 if mirrored else 0) | (2 if reset else 0)
        t0 = time.perf_counter()
        self.p.stdin.write(HEADER.pack(MAGIC, fid, t, src_w, src_h, flags, len(payload)) + payload)
        self.p.stdin.flush()
        line = self.p.stdout.readline()
        rt = (time.perf_counter() - t0) * 1e3
        msg = json.loads(line)
        assert msg["type"] == "frame" and msg["id"] == fid, msg
        return msg, rt

    def close(self):
        self.p.stdin.close()
        self.p.wait(timeout=10)


def run(clip, args, fixed: bool):
    label, path, start, n, mirrored, frets = clip
    use_frets = frets if fixed else None
    py = FretboardTracker(args.mlpackage, mirrored=mirrored, frets=use_frets, compute_units="ALL")
    sw = Helper(args.helper, args.mlmodelc, use_frets)
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(start * fps)))
    rows = []
    for i in range(n):
        ok, frame = cap.read()
        if not ok:
            break
        t = i / fps
        h, w = frame.shape[:2]
        st = py.process(frame, t)
        canon = cv2.flip(frame, 1) if mirrored else frame
        msg, rt = sw.frame(i, t, canon, w, h, mirrored, reset=(i == 0))
        row = {"i": i, "py_valid": bool(st.valid), "sw_valid": bool(msg["valid"]), "py_n": int(st.n_frets),
               "sw_n": msg["nFrets"], "py_end": st.end_estimate, "sw_end": msg["endEstimate"], "rt_ms": rt,
               "sw_t": msg["timingsMs"], "py_t": {k: float(v) for k, v in st.timings_ms.items()},
               "py_held": bool(st.held), "sw_held": bool(msg["held"]),
               "py_rmse": float(st.rmse_px), "sw_rmse": msg["rmsePx"]}
        # keypoints (original-frame px), slots with conf > 0.5 on both sides
        kp = np.asarray(st.kpts, float)
        ks = np.array([np.nan if v is None else v for v in msg["kpts"]], float).reshape(50, 3)
        both = (kp[:, 2] > 0.5) & (ks[:, 2] > 0.5)
        row["kpt_px"] = np.linalg.norm(kp[both, :2] - ks[both, :2], axis=1).tolist()
        row["conf_diff"] = np.abs(kp[:, 2] - ks[:, 2])[np.isfinite(kp[:, 2]) & np.isfinite(ks[:, 2])].tolist()
        row["anchor_flips"] = int(((kp[:, 2] > 0.5) != (ks[:, 2] > 0.5)).sum())
        if st.valid and msg["valid"]:
            pw = st.wires()
            swr = np.asarray(msg["wires"], float)
            m = min(len(pw), len(swr))
            d = np.linalg.norm(pw[:m] - swr[:m], axis=-1)  # (m, 2) endpoint diffs
            row["wire_mean"] = float(d.mean())
            row["wire_max"] = float(d.max())
            Hs = np.asarray(msg["H"], float).reshape(3, 3)
            row["H_ok"] = bool(np.isfinite(Hs).all())
        rows.append(row)
    sw.close()
    return summarize(label, mirrored, use_frets, rows), rows


def latency(clip, args):
    """Helper alone (no Python model sharing the ANE): frames pre-letterboxed, then sent back to back."""
    label, path, start, n, mirrored, frets = clip
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(start * fps)))
    frames = []
    for _ in range(n):
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.flip(frame, 1) if mirrored else frame)
    sw = Helper(args.helper, args.mlmodelc)
    rts, sw_t = [], []
    for i, canon in enumerate(frames):
        h, w = canon.shape[:2]
        lb = Letterbox.for_shape(canon.shape, 640)
        payload = np.ascontiguousarray(cv2.cvtColor(lb.apply(canon), cv2.COLOR_BGR2RGBA)).tobytes()
        flags = (1 if mirrored else 0) | (2 if i == 0 else 0)
        t0 = time.perf_counter()
        sw.p.stdin.write(HEADER.pack(MAGIC, i, i / fps, w, h, flags, len(payload)) + payload)
        sw.p.stdin.flush()
        msg = json.loads(sw.p.stdout.readline())
        rts.append((time.perf_counter() - t0) * 1e3)
        sw_t.append(msg["timingsMs"])
    sw.close()
    return {"clip": label, "frames": len(frames), "loadMs": sw.ready["loadMs"],
            "swift_ms": {k: stats([t[k] for t in sw_t]) for k in ("prep", "model", "post", "total")},
            "roundtrip_ms": stats(rts)}


def summarize(label, mirrored, frets, rows):
    both = [r for r in rows if r["py_valid"] and r["sw_valid"]]
    ends = [r for r in rows if r["py_end"] is not None or r["sw_end"] is not None]
    allk = [d for r in rows for d in r["kpt_px"]]
    allc = [d for r in rows for d in r["conf_diff"]]

    def pick(key, side):
        return [r[side][key] for r in rows]

    return {
        "clip": label,
        "mirrored": mirrored,
        "frets": frets if frets else "voted",
        "frames": len(rows),
        "py_valid": sum(r["py_valid"] for r in rows),
        "sw_valid": sum(r["sw_valid"] for r in rows),
        "valid_agree_pct": 100.0 * sum(r["py_valid"] == r["sw_valid"] for r in rows) / max(1, len(rows)),
        "both_valid": len(both),
        "nfrets_agree_pct": 100.0 * sum(r["py_n"] == r["sw_n"] for r in rows) / max(1, len(rows)),
        "nfrets_py_final": rows[-1]["py_n"] if rows else None,
        "nfrets_sw_final": rows[-1]["sw_n"] if rows else None,
        "held_agree_pct": 100.0 * sum(r["py_held"] == r["sw_held"] for r in rows) / max(1, len(rows)),
        "end_estimate_frames": len(ends),
        "end_estimate_agree_pct": (100.0 * sum(r["py_end"] == r["sw_end"] for r in ends) / len(ends)) if ends else None,
        "wire_px_frame_mean": stats([r["wire_mean"] for r in both]),
        "wire_px_frame_max": stats([r["wire_max"] for r in both]),
        "rmse_px_diff": stats([abs(r["py_rmse"] - r["sw_rmse"]) for r in rows
                               if r["sw_rmse"] is not None and np.isfinite(r["py_rmse"])]),
        "kpt_px": stats(allk),
        "kpt_conf_abs_diff": stats(allc),
        "anchor_flips_per_frame": float(np.mean([r["anchor_flips"] for r in rows])) if rows else None,
        "swift_ms": {k: stats(pick(k, "sw_t")) for k in ("prep", "model", "post", "total")},
        "python_ms": {k: stats(pick(k, "py_t")) for k in ("model", "post", "total")},
        "roundtrip_ms": stats([r["rt_ms"] for r in rows]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--helper", required=True)
    ap.add_argument("--mlmodelc", required=True)
    ap.add_argument("--mlpackage", required=True)
    ap.add_argument("--clip", action="append", required=True, help="label:path:start_s:n:[mirrored]:frets")
    ap.add_argument("--out", required=True)
    ap.add_argument("--rows", help="optional per-frame rows JSON")
    a = ap.parse_args()
    clips = []
    for c in a.clip:
        label, path, start, n, mir, frets = c.split(":")
        clips.append((label, path, float(start), int(n), mir == "mirrored", int(frets)))
    results, all_rows = [], {}
    for clip in clips:
        for fixed in (False, True):
            summary, rows = run(clip, a, fixed)
            results.append(summary)
            all_rows[f"{clip[0]}:{'fixed' if fixed else 'voted'}"] = rows
            s = summary
            w = s["wire_px_frame_max"] or {}
            if not s["frames"]:
                print(f"{s['clip']}: no frames read", flush=True)
                continue
            print(f"{s['clip']:6s} frets={s['frets']!s:5s} frames={s['frames']} valid py/sw={s['py_valid']}/{s['sw_valid']} "
                  f"agree={s['valid_agree_pct']:.1f}% nFrets agree={s['nfrets_agree_pct']:.1f}% "
                  f"wire max px mean/p95/max={w.get('mean', float('nan')):.2f}/{w.get('p95', float('nan')):.2f}/"
                  f"{w.get('max', float('nan')):.2f} kpt p95={(s['kpt_px'] or {}).get('p95', float('nan')):.3f} "
                  f"sw total med={s['swift_ms']['total']['median']:.2f}ms rt med={s['roundtrip_ms']['median']:.2f}ms",
                  flush=True)
    lat = []
    for clip in clips:
        r = latency(clip, a)
        lat.append(r)
        print(f"latency {r['clip']}: swift model/post/total med={r['swift_ms']['model']['median']:.2f}/"
              f"{r['swift_ms']['post']['median']:.3f}/{r['swift_ms']['total']['median']:.2f} ms "
              f"(p95 total {r['swift_ms']['total']['p95']:.2f}), round trip med/p95="
              f"{r['roundtrip_ms']['median']:.2f}/{r['roundtrip_ms']['p95']:.2f} ms", flush=True)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps({"results": results, "latency_helper_only": lat}, indent=1))
    if a.rows:
        Path(a.rows).write_text(json.dumps(all_rows))


if __name__ == "__main__":
    main()
