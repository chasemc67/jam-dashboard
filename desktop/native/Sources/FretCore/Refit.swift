import Foundation

/// Query-head FretNet models: VAL-selected 0.30-fret rejection, before unletterboxing/clipping.
/// Keep observed coordinates/confidence and side, relabel to the nearest fitted wire,
/// reject ambiguous/nonfinite/out-of-range points, and keep the first highest-confidence collision.
public func reassignFittedWires(_ kpts: [Float], H: Mat3, tolerance: Double = 0.30) -> [Float] {
    precondition(kpts.count == nKpts * 3)
    let m = H.m
    // Homogeneous inverse via adjugate (the determinant cancels in apply).
    let inverse = Mat3([
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
    ])
    var out = [Float](repeating: 0, count: kpts.count)
    for i in 0..<nKpts {
        let x = kpts[3 * i], y = kpts[3 * i + 1], c = kpts[3 * i + 2]
        guard x.isFinite, y.isFinite, c.isFinite, c > 0 else { continue }
        let (u, _) = inverse.apply(Double(x), Double(y))
        let fret = -12 * log2(1 - u)
        guard fret.isFinite else { continue }
        let nearest = fret.rounded(.toNearestOrEven)
        guard abs(fret - nearest) < tolerance, nearest >= 0, nearest < 25 else { continue }
        let j = 2 * Int(nearest) + i % 2
        if c > out[3 * j + 2] {
            out[3 * j] = x
            out[3 * j + 1] = y
            out[3 * j + 2] = c
        }
    }
    return out
}

/// Matches the geometry-only Python backend; failure retains stage-one predictions.
public func refitFretNet(_ kpts: [Float]) -> [Float] {
    guard kpts.count == nKpts * 3, kpts.allSatisfy({ $0.isFinite }) else { return kpts }
    let anchors = anchorsFrom(kpts)
    guard let fit = try? fitFretboard(anchors, ransacIters: 100,
                                     ransacSamples: refitRansacSamples(count: anchors.count)) else { return kpts }
    return reassignFittedWires(kpts, H: fit.H)
}
