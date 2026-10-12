// Projects the canonical fretboard plane onto a tracked camera frame (same model
// as gro.geometry in guitar-overlay): u = 1 - 2^(-fret/12) along the neck, y = 0
// on the low E edge and 1 on the high E edge, and the tapered plane point
// P(u, y) = (u, (y - 0.5)(1 + tau u)). H (3x3, row-major) maps P to frame pixels.

export const DEFAULT_TAU = 0.3;

export type Point = [number, number];
export type Homography = readonly number[]; // 9 numbers, row-major
export type Quad = [Point, Point, Point, Point];

export const fretU = (fret: number) => 1 - Math.pow(2, -fret / 12);

export const planePoint = (u: number, y: number, tau = DEFAULT_TAU): Point => [
  u,
  (y - 0.5) * (1 + tau * u),
];

export function applyH(H: Homography, [x, y]: Point): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** Image point of (fractional) fret number `fret` at canonical across-neck `y`. */
export const projectFret = (
  H: Homography,
  fret: number,
  y: number,
  tau = DEFAULT_TAU,
): Point => applyH(H, planePoint(fretU(fret), y, tau));

/** Canonical y of a string (D13: strings evenly spaced, low E at 0, high E at 1). */
export const stringY = (stringIndexFromLowE: number, stringCount: number) =>
  stringCount > 1 ? stringIndexFromLowE / (stringCount - 1) : 0.5;

/**
 * Canonical y of a 1-based string number in tuning order (string 1 is the
 * first tuning entry, normally high E).
 */
export const tuningStringY = (stringNumber: number, stringCount: number) =>
  stringY(stringCount - stringNumber, stringCount);

/** [low E end, high E end] of wire `n` (0 = nut). */
export const wireEnds = (
  H: Homography,
  n: number,
  tau = DEFAULT_TAU,
): [Point, Point] => [projectFret(H, n, 0, tau), projectFret(H, n, 1, tau)];

/**
 * Image quad of the patch in the cell between wires `fret - 1` and `fret`,
 * spanning canonical y0..y1. `inset` shrinks it along the neck by that
 * fraction of the cell length on each side. Corners: nut/y0, bridge/y0,
 * bridge/y1, nut/y1.
 */
export function cellQuad(
  H: Homography,
  fret: number,
  y0: number,
  y1: number,
  { inset = 0, from = 0, to = 1, tau = DEFAULT_TAU } = {},
): Quad {
  const ua = fretU(fret - 1);
  const ub = fretU(fret);
  const length = ub - ua;
  const start = ua + length * (inset + (1 - 2 * inset) * from);
  const end = ua + length * (inset + (1 - 2 * inset) * to);
  return [
    applyH(H, planePoint(start, y0, tau)),
    applyH(H, planePoint(end, y0, tau)),
    applyH(H, planePoint(end, y1, tau)),
    applyH(H, planePoint(start, y1, tau)),
  ];
}

/** H for the horizontally mirrored frame (x -> width - 1 - x), as in D1. */
export function mirrorH(H: Homography, width: number): number[] {
  return [
    -H[0] + (width - 1) * H[6],
    -H[1] + (width - 1) * H[7],
    -H[2] + (width - 1) * H[8],
    H[3],
    H[4],
    H[5],
    H[6],
    H[7],
    H[8],
  ];
}

/** Every finite corner keeps the same side of the horizon (no wrap through infinity). */
export function isProjectable(
  H: Homography,
  frets: number,
  tau = DEFAULT_TAU,
): boolean {
  if (H.length !== 9 || !H.every(Number.isFinite)) return false;
  const signs = [0, frets].flatMap(fret =>
    [0, 1].map(y => {
      const [px, py] = planePoint(fretU(fret), y, tau);
      return Math.sign(H[6] * px + H[7] * py + H[8]);
    }),
  );
  return signs.every(sign => sign !== 0 && sign === signs[0]);
}

export type LetterboxPlacement = {
  size: number;
  width: number;
  height: number;
  newWidth: number;
  newHeight: number;
  left: number;
  top: number;
};

// Python's round() is round-half-to-even; the ultralytics letterbox relies on it.
const roundHalfEven = (value: number) => {
  const floor = Math.floor(value);
  const diff = value - floor;
  const rounded =
    Math.abs(diff - 0.5) > 1e-9
      ? Math.round(value)
      : floor % 2 === 0
        ? floor
        : floor + 1;
  return rounded + 0; // no -0
};

/** Where a width x height frame sits in the square model input (ultralytics LetterBox). */
export function letterbox(
  width: number,
  height: number,
  size = 640,
): LetterboxPlacement {
  const r = Math.min(size / height, size / width);
  const newWidth = roundHalfEven(width * r);
  const newHeight = roundHalfEven(height * r);
  return {
    size,
    width,
    height,
    newWidth,
    newHeight,
    left: roundHalfEven((size - newWidth) / 2 - 0.1),
    top: roundHalfEven((size - newHeight) / 2 - 0.1),
  };
}
