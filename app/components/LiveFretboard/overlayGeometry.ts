// Turns a tracked fretboard (H in source pixels) and the dashboard's note markers
// into screen-space shapes for the WebGL overlay. Everything is laid out in the
// canonical (fret, y) plane and projected, so the patches follow the perspective.
import {
  DEFAULT_TAU,
  applyH,
  cellQuad,
  fretU,
  isProjectable,
  mirrorH,
  planePoint,
  projectFret,
  tuningStringY,
  type Homography,
  type Point,
  type Quad,
} from '~/utils/fretProjection';
import type { FretNoteMarker } from '~/utils/fretNoteMarkers';

export type OverlayCell = { quad: Quad; color: string };
export type OverlayLabel = { center: Point; size: number; text: string };
export type OverlayGeometry = {
  cells: OverlayCell[];
  wires: [Point, Point][];
  strings: [Point, Point][];
  labels: OverlayLabel[];
};

export const EMPTY_OVERLAY: OverlayGeometry = {
  cells: [],
  wires: [],
  strings: [],
  labels: [],
};

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function buildOverlay({
  H: sourceH,
  nFrets,
  tau = DEFAULT_TAU,
  markers,
  stringCount,
  width,
  mirrored,
}: {
  H: Homography | null;
  nFrets: number;
  tau?: number;
  markers: FretNoteMarker[];
  stringCount: number;
  /** Source width, used to mirror the overlay with the displayed video. */
  width: number;
  mirrored: boolean;
}): OverlayGeometry {
  if (!sourceH || stringCount < 2 || !isProjectable(sourceH, nFrets, tau))
    return EMPTY_OVERLAY;
  const H = mirrored ? mirrorH(sourceH, width) : sourceH;
  const wires: [Point, Point][] = [];
  for (let n = 0; n <= nFrets; n++)
    wires.push([projectFret(H, n, 0, tau), projectFret(H, n, 1, tau)]);
  const strings: [Point, Point][] = [];
  for (let s = 1; s <= stringCount; s++) {
    const y = tuningStringY(s, stringCount);
    strings.push([projectFret(H, 0, y, tau), projectFret(H, nFrets, y, tau)]);
  }
  // Patches cover 80% of the string spacing and 80% of the cell length.
  const half = 0.4 / (stringCount - 1);
  const cells: OverlayCell[] = [];
  const labels: OverlayLabel[] = [];
  for (const marker of markers) {
    if (marker.fret < 1 || marker.fret > nFrets) continue;
    if (marker.string < 1 || marker.string > stringCount) continue;
    const y = tuningStringY(marker.string, stringCount);
    const y0 = y - half;
    const y1 = y + half;
    const options = { inset: 0.1, tau };
    if (marker.colors.length === 2) {
      cells.push({
        quad: cellQuad(H, marker.fret, y0, y1, { ...options, to: 0.5 }),
        color: marker.colors[0],
      });
      cells.push({
        quad: cellQuad(H, marker.fret, y0, y1, { ...options, from: 0.5 }),
        color: marker.colors[1],
      });
    } else {
      cells.push({
        quad: cellQuad(H, marker.fret, y0, y1, options),
        color: marker.colors[0],
      });
    }
    const ua = fretU(marker.fret - 1);
    const ub = fretU(marker.fret);
    const uc = (ua + ub) / 2;
    const along = distance(
      applyH(H, planePoint(ua + (ub - ua) * 0.15, y, tau)),
      applyH(H, planePoint(ub - (ub - ua) * 0.15, y, tau)),
    );
    const across = distance(
      applyH(H, planePoint(uc, y0, tau)),
      applyH(H, planePoint(uc, y1, tau)),
    );
    if (marker.label)
      labels.push({
        center: applyH(H, planePoint(uc, y, tau)),
        size: Math.max(6, Math.min(48, Math.min(along, across))),
        text: marker.label,
      });
  }
  return { cells, wires, strings, labels };
}
