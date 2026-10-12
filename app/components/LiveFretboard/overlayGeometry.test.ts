import { buildOverlay } from './overlayGeometry';
import { cellQuad, mirrorH, projectFret } from '~/utils/fretProjection';
import type { FretNoteMarker } from '~/utils/fretNoteMarkers';

const H = [1500, -40, 200, 30, 180, 400, 0.2, 0.05, 1];
const marker = (
  string: number,
  fret: number,
  colors: FretNoteMarker['colors'] = ['red'],
): FretNoteMarker => ({
  string,
  fret,
  note: 'A',
  label: 'I',
  colors,
  caged: colors.length === 2,
});

describe('buildOverlay', () => {
  it('draws every wire, six strings and one patch per marker', () => {
    const overlay = buildOverlay({
      H,
      nFrets: 22,
      markers: [marker(6, 5), marker(1, 3), marker(2, 23), marker(3, 0)],
      stringCount: 6,
      width: 1920,
      mirrored: false,
    });
    expect(overlay.wires).toHaveLength(23);
    expect(overlay.strings).toHaveLength(6);
    // Fret 23 is past the tracked board end and fret 0 has no cell.
    expect(overlay.cells).toHaveLength(2);
    expect(overlay.labels.map(label => label.text)).toEqual(['I', 'I']);
    // String 6 (low E) is centered on y = 0, between wires 4 and 5.
    expect(overlay.cells[0].quad).toEqual(
      cellQuad(H, 5, -0.08, 0.08, { inset: 0.1 }),
    );
    const [lowE] = overlay.strings;
    expect(overlay.strings[5][0]).toEqual(projectFret(H, 0, 0));
    expect(lowE[0]).toEqual(projectFret(H, 0, 1)); // string 1 = high E
  });

  it('splits two-shape CAGED notes along the neck, nut side first', () => {
    const overlay = buildOverlay({
      H,
      nFrets: 22,
      markers: [marker(4, 7, ['red', 'blue'])],
      stringCount: 6,
      width: 1920,
      mirrored: false,
    });
    expect(overlay.cells.map(cell => cell.color)).toEqual(['red', 'blue']);
    expect(overlay.cells[0].quad[1]).toEqual(overlay.cells[1].quad[0]);
  });

  it('mirrors the overlay with the displayed video', () => {
    const overlay = buildOverlay({
      H,
      nFrets: 12,
      markers: [],
      stringCount: 6,
      width: 1280,
      mirrored: true,
    });
    expect(overlay.wires[12][0]).toEqual(projectFret(mirrorH(H, 1280), 12, 0));
  });

  it('draws nothing without a usable fit', () => {
    const options = {
      nFrets: 22,
      markers: [marker(1, 1)],
      stringCount: 6,
      width: 1920,
      mirrored: false,
    };
    expect(buildOverlay({ ...options, H: null }).cells).toEqual([]);
    expect(
      buildOverlay({ ...options, H: [1, 0, 0, 0, 1, 0, -2, 0, 1] }).wires,
    ).toEqual([]);
  });
});
