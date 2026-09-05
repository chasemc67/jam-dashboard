"""Temporal smoothing and optical-flow tracking of fretboard corners."""

from __future__ import annotations

import cv2
import numpy as np

from .geometry import order_fretboard_corners


class QuadTracker:
    """Keep a stable fretboard quad across frames.

    New detections are blended with the previous quad. Between detections,
    Lucas-Kanade optical flow carries the four corners forward.
    """

    def __init__(self, blend: float = 0.35, max_flow_error: float = 25.0):
        self.blend = blend
        self.max_flow_error = max_flow_error
        self.corners: np.ndarray | None = None
        self.prev_gray: np.ndarray | None = None
        self.missed = 0

    @property
    def locked(self) -> bool:
        return self.corners is not None

    def update(
        self,
        frame: np.ndarray,
        detected_corners: np.ndarray | None,
    ) -> np.ndarray | None:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        flowed = self._flow(gray)

        if detected_corners is not None:
            detected = order_fretboard_corners(detected_corners)
            if self.corners is None:
                self.corners = detected
            else:
                base = flowed if flowed is not None else self.corners
                self.corners = order_fretboard_corners(
                    (1.0 - self.blend) * base + self.blend * detected
                )
            self.missed = 0
        elif flowed is not None:
            self.corners = flowed
            self.missed += 1
        else:
            self.missed += 1
            if self.missed > 30:
                self.corners = None

        self.prev_gray = gray
        return None if self.corners is None else self.corners.copy()

    def _flow(self, gray: np.ndarray) -> np.ndarray | None:
        if self.corners is None or self.prev_gray is None:
            return None
        prev_pts = self.corners.reshape(-1, 1, 2).astype(np.float32)
        next_pts, status, err = cv2.calcOpticalFlowPyrLK(
            self.prev_gray,
            gray,
            prev_pts,
            None,
            winSize=(21, 21),
            maxLevel=3,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01),
        )
        if next_pts is None or status is None:
            return None
        status = status.reshape(-1)
        if int(status.sum()) < 4:
            return None
        if err is not None and float(np.max(err)) > self.max_flow_error:
            return None
        return order_fretboard_corners(next_pts.reshape(4, 2))

    def reset(self) -> None:
        self.corners = None
        self.prev_gray = None
        self.missed = 0
