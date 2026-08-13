"""Fretboard detectors. YOLO backends are optional; contour/manual always work."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import cv2
import numpy as np

from .geometry import order_fretboard_corners, quad_from_contour
from .neck import neck_quad_from_lines, neck_quad_from_mask


@dataclass
class Detection:
    corners: np.ndarray
    confidence: float
    label: str
    box_xyxy: np.ndarray | None = None


class Detector(Protocol):
    name: str

    def detect(self, frame: np.ndarray) -> Detection | None: ...


def _largest_contour(mask: np.ndarray, min_area: float) -> np.ndarray | None:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < min_area:
        return None
    return contour


def mask_to_detection(
    mask: np.ndarray,
    *,
    confidence: float,
    label: str,
    box_xyxy: np.ndarray | None = None,
) -> Detection | None:
    min_area = 0.01 * mask.shape[0] * mask.shape[1]
    contour = _largest_contour(mask, min_area)
    if contour is None:
        return None
    corners = quad_from_contour(contour)
    return Detection(
        corners=corners,
        confidence=confidence,
        label=label,
        box_xyxy=box_xyxy,
    )


def box_to_detection(
    frame: np.ndarray,
    box_xyxy: np.ndarray,
    *,
    confidence: float,
    label: str,
) -> Detection:
    """Turn a detector box into a neck quad.

    Prefer a bundle of parallel string/neck lines. Fall back to GrabCut plus
    a thin-region profile, then the box itself.
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [int(round(v)) for v in box_xyxy]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w - 1, x2), min(h - 1, y2)
    if x2 <= x1 + 8 or y2 <= y1 + 8:
        corners = order_fretboard_corners(
            np.array([[x1, y2], [x2, y2], [x2, y1], [x1, y1]], dtype=np.float32)
        )
        return Detection(corners=corners, confidence=confidence, label=label, box_xyxy=box_xyxy)

    line_quad = neck_quad_from_lines(frame, box_xyxy)
    if line_quad is not None:
        return Detection(
            corners=line_quad,
            confidence=confidence,
            label=f"{label}-lines",
            box_xyxy=box_xyxy,
        )

    rect = (x1, y1, x2 - x1, y2 - y1)
    mask = np.zeros(frame.shape[:2], np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(frame, mask, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(
            np.uint8
        )
        neck = neck_quad_from_mask(fg)
        if neck is not None:
            return Detection(
                corners=neck,
                confidence=confidence,
                label=f"{label}-neck",
                box_xyxy=box_xyxy,
            )
        detection = mask_to_detection(
            fg, confidence=confidence, label=label, box_xyxy=box_xyxy
        )
        if detection is not None:
            return detection
    except cv2.error:
        pass

    crop_mask = np.zeros(frame.shape[:2], np.uint8)
    crop_mask[y1:y2, x1:x2] = 255
    detection = mask_to_detection(
        crop_mask, confidence=confidence, label=label, box_xyxy=box_xyxy
    )
    if detection is not None:
        return detection
    corners = order_fretboard_corners(
        np.array([[x1, y2], [x2, y2], [x2, y1], [x1, y1]], dtype=np.float32)
    )
    return Detection(corners=corners, confidence=confidence, label=label, box_xyxy=box_xyxy)


class ManualDetector:
    """Always returns the supplied corners. Useful for `--corners` and tests."""

    name = "manual"

    def __init__(self, corners: np.ndarray, confidence: float = 1.0):
        self._detection = Detection(
            corners=order_fretboard_corners(corners),
            confidence=confidence,
            label="manual",
        )

    def detect(self, frame: np.ndarray) -> Detection | None:
        return self._detection


class ContourDetector:
    """Find a high-contrast elongated region. Works well on synthetic necks."""

    name = "contour"

    def __init__(self, min_aspect: float = 2.2):
        self.min_aspect = min_aspect

    def detect(self, frame: np.ndarray) -> Detection | None:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        min_area = 0.02 * frame.shape[0] * frame.shape[1]

        _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # The fretboard should be the smaller of the two blobs on a typical shot.
        if int(np.count_nonzero(thresh)) > thresh.size // 2:
            thresh = cv2.bitwise_not(thresh)
        thresh = cv2.morphologyEx(
            thresh, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=1
        )

        contour = _largest_contour(thresh, min_area)
        if contour is None:
            edges = cv2.Canny(blur, 40, 120)
            edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
            contour = _largest_contour(edges, min_area)
            if contour is None:
                return None

        rect = cv2.minAreaRect(contour)
        w, h = rect[1]
        if min(w, h) < 1:
            return None
        aspect = max(w, h) / max(1.0, min(w, h))
        if aspect < self.min_aspect:
            return None
        corners = quad_from_contour(contour)
        return Detection(corners=corners, confidence=0.6, label="contour")


class YoloWorldDetector:
    """Open-vocabulary detector. No custom training — prompt for a guitar neck."""

    name = "yolo-world"

    def __init__(
        self,
        prompts: list[str] | None = None,
        conf: float = 0.15,
        model_name: str = "yolov8s-worldv2.pt",
    ):
        try:
            from ultralytics import YOLOWorld
        except ImportError as exc:
            raise ImportError(
                "ultralytics is required for yolo-world. "
                "Install with: pip install -r fretboard_cam/requirements-ml.txt"
            ) from exc
        self.prompts = prompts or [
            "guitar neck",
            "guitar fretboard",
            "fretboard",
            "guitar",
        ]
        self.conf = conf
        self.model = YOLOWorld(model_name)
        self.model.set_classes(self.prompts)
        self._preferred = {"guitar neck", "guitar fretboard", "fretboard"}

    def detect(self, frame: np.ndarray) -> Detection | None:
        results = self.model.predict(frame, conf=self.conf, verbose=False)
        if not results:
            return None
        result = results[0]
        if result.boxes is None or len(result.boxes) == 0:
            return None

        best_idx = None
        best_score = -1.0
        names = result.names
        for i in range(len(result.boxes)):
            cls_id = int(result.boxes.cls[i].item())
            label = names.get(cls_id, str(cls_id))
            conf = float(result.boxes.conf[i].item())
            bonus = 0.25 if label in self._preferred else 0.0
            score = conf + bonus
            if score > best_score:
                best_score = score
                best_idx = i
        if best_idx is None:
            return None
        box = result.boxes.xyxy[best_idx].cpu().numpy()
        cls_id = int(result.boxes.cls[best_idx].item())
        label = result.names.get(cls_id, "guitar")
        conf = float(result.boxes.conf[best_idx].item())
        return box_to_detection(frame, box, confidence=conf, label=label)


class YoloCocoGuitarDetector:
    """COCO-pretrained YOLO. Class 74 is guitar — no custom training."""

    name = "yolo-coco"

    def __init__(self, conf: float = 0.2, model_name: str = "yolov8s.pt"):
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise ImportError(
                "ultralytics is required for yolo-coco. "
                "Install with: pip install -r fretboard_cam/requirements-ml.txt"
            ) from exc
        self.conf = conf
        self.model = YOLO(model_name)

    def detect(self, frame: np.ndarray) -> Detection | None:
        results = self.model.predict(frame, conf=self.conf, verbose=False, classes=[74])
        if not results or results[0].boxes is None or len(results[0].boxes) == 0:
            return None
        box = results[0].boxes.xyxy[0].cpu().numpy()
        conf = float(results[0].boxes.conf[0].item())
        return box_to_detection(frame, box, confidence=conf, label="guitar")


def build_detector(name: str, corners: np.ndarray | None = None) -> Detector:
    key = name.lower().replace("_", "-")
    if key == "manual":
        if corners is None:
            raise ValueError("manual detector requires corners")
        return ManualDetector(corners)
    if key == "contour":
        return ContourDetector()
    if key in {"yolo-world", "yoloworld", "world"}:
        return YoloWorldDetector()
    if key in {"yolo-coco", "yolo", "coco"}:
        return YoloCocoGuitarDetector()
    raise ValueError(f"unknown detector: {name}")
