import {
  applyH,
  cellQuad,
  fretU,
  isProjectable,
  letterbox,
  mirrorH,
  projectFret,
  stringY,
  tuningStringY,
  wireEnds,
  type Point,
} from './fretProjection';

// Expected values come from gro.geometry.FretboardModel (guitar-overlay) for this H.
const H = [1500, -40, 200, 30, 180, 400, 0.2, 0.05, 1];

const expectPoint = (actual: Point, expected: Point) => {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
};

describe('fretProjection', () => {
  it('uses twelfth-root-of-two fret spacing', () => {
    expect(fretU(0)).toBe(0);
    expect(fretU(12)).toBeCloseTo(0.5, 12);
    expect(fretU(24)).toBeCloseTo(0.75, 12);
  });

  it('projects wires like the Python tracker', () => {
    const [nutLow, nutHigh] = wireEnds(H, 0);
    expectPoint(nutLow, [225.64102564102564, 317.94871794871796]);
    expectPoint(nutHigh, [175.609756097561, 478.04878048780495]);
    const [low12, high12] = wireEnds(H, 12);
    expectPoint(low12, [908.2847141190198, 290.78179696616104]);
    expectPoint(high12, [821.2624584717609, 459.3576965669989]);
  });

  it('projects inset cell quads like FretboardModel.cell_quad', () => {
    const quad = cellQuad(H, 5, 0, 1, { inset: 0.1 });
    const expected: Point[] = [
      [529.1567197394083, 305.8698149753076],
      [578.0989948042603, 303.9220771703074],
      [509.3354732884027, 468.38771136564696],
      [463.0412206957285, 469.72788969538806],
    ];
    quad.forEach((corner, i) => expectPoint(corner, expected[i]));
  });

  it('splits a cell along the neck', () => {
    const whole = cellQuad(H, 7, 0.2, 0.4);
    const nutHalf = cellQuad(H, 7, 0.2, 0.4, { to: 0.5 });
    const bridgeHalf = cellQuad(H, 7, 0.2, 0.4, { from: 0.5 });
    expectPoint(nutHalf[0], whole[0]);
    expectPoint(bridgeHalf[1], whole[1]);
    expectPoint(nutHalf[1], bridgeHalf[0]);
  });

  it('mirrors H the same way as gro.geometry.mirror_model', () => {
    const mirrored = mirrorH(H, 1920);
    expectPoint(
      projectFret(mirrored, 3, 0),
      [1461.961955573914, 308.73989549706846],
    );
    expectPoint(
      projectFret(mirrored, 3, 1),
      [1524.2029953810331, 471.7035003682929],
    );
    const p = projectFret(H, 9, 0.5);
    const q = projectFret(mirrored, 9, 0.5);
    expect(q[0]).toBeCloseTo(1919 - p[0], 6);
    expect(q[1]).toBeCloseTo(p[1], 6);
  });

  it('spaces strings evenly from low E (y = 0) to high E (y = 1)', () => {
    expect([0, 1, 2, 3, 4, 5].map(s => stringY(s, 6))).toEqual([
      0, 0.2, 0.4, 0.6, 0.8, 1,
    ]);
    // Tuning order lists high E first.
    expect(tuningStringY(1, 6)).toBe(1);
    expect(tuningStringY(6, 6)).toBe(0);
  });

  it('rejects homographies that wrap the board through infinity', () => {
    expect(isProjectable(H, 22)).toBe(true);
    expect(isProjectable([1, 0, 0, 0, 1, 0, -2, 0, 1], 22)).toBe(false);
    expect(isProjectable([1, 0, 0, 0, 1, 0, 0, 0, NaN], 22)).toBe(false);
  });

  it('applies H to a plane point', () => {
    expectPoint(applyH([2, 0, 1, 0, 2, 1, 0, 0, 1], [3, 4]), [7, 9]);
  });

  it('letterboxes like ultralytics', () => {
    expect(letterbox(1920, 1080)).toMatchObject({
      newWidth: 640,
      newHeight: 360,
      left: 0,
      top: 140,
    });
    expect(letterbox(720, 1280)).toMatchObject({
      newWidth: 360,
      newHeight: 640,
      left: 140,
      top: 0,
    });
    expect(letterbox(640, 480)).toMatchObject({ top: 80, left: 0 });
    expect(letterbox(1919, 1081)).toMatchObject({ newHeight: 361, top: 139 });
  });
});
