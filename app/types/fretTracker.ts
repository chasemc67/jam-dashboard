// Renderer contract for the desktop fret tracker (desktop/tracker.cjs).

export type FretTrackerFrame = {
  /** Capture time in seconds. */
  t: number;
  /** Source video size; results are in these pixels. */
  width: number;
  height: number;
  /** Pixels are letterboxed from the horizontally flipped source. */
  mirrored: boolean;
  /** Restart smoothing and the fret count vote (new source or setting). */
  reset: boolean;
  /** 640x640 RGBA, letterboxed like ultralytics (gray 114 padding). */
  pixels: Uint8Array | Uint8ClampedArray;
};

export type FretTrackerResult = {
  id: number;
  t: number | null;
  valid: boolean;
  held: boolean;
  nFrets: number;
  tau: number;
  /** Canonical fretboard plane -> source pixels, row-major (unmirrored source). */
  H: number[] | null;
  wires: [number, number][][] | null;
  boardScore: number | null;
  anchors: number;
  rmsePx: number | null;
  timingsMs: Partial<
    Record<'prep' | 'model' | 'post' | 'total', number | null>
  >;
};

export type DesktopFretTrackerAPI = {
  /** Null when the frame was skipped (tracker busy or stopping). */
  track: (frame: FretTrackerFrame) => Promise<FretTrackerResult | null>;
  stop: () => Promise<void>;
};
