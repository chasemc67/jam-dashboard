import Foundation

// Port of gro.geometry (guitar-overlay): canonical fretboard coordinates and the robust plane->image homography fit.
//
// Canonical coordinates: u = 1 - 2^(-fret/12) along the neck, y = 0 on the bass (low-E) edge .. 1 on the treble edge.
// Physical plane point P(u, y) = (u, (y - 0.5) * (1 + tau * u)). H maps P to image pixels.

public let defaultTau = 0.30

/// 3x3 matrix, row-major (stored inline, no heap allocation).
public struct Mat3: Equatable {
    public var a0, a1, a2, a3, a4, a5, a6, a7, a8: Double

    public init(_ m: [Double]) {
        precondition(m.count == 9)
        (a0, a1, a2, a3, a4, a5, a6, a7, a8) = (m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8])
    }

    @inline(__always)
    public init(_ a0: Double, _ a1: Double, _ a2: Double, _ a3: Double, _ a4: Double, _ a5: Double,
                _ a6: Double, _ a7: Double, _ a8: Double)
    {
        (self.a0, self.a1, self.a2, self.a3, self.a4, self.a5, self.a6, self.a7, self.a8) = (a0, a1, a2, a3, a4, a5, a6, a7, a8)
    }

    public static let identity = Mat3(1, 0, 0, 0, 1, 0, 0, 0, 1)

    /// Row-major values.
    public var m: [Double] { [a0, a1, a2, a3, a4, a5, a6, a7, a8] }

    public subscript(r: Int, c: Int) -> Double { m[r * 3 + c] }

    @inline(__always)
    public static func * (a: Mat3, b: Mat3) -> Mat3 {
        Mat3(
            a.a0 * b.a0 + a.a1 * b.a3 + a.a2 * b.a6, a.a0 * b.a1 + a.a1 * b.a4 + a.a2 * b.a7, a.a0 * b.a2 + a.a1 * b.a5 + a.a2 * b.a8,
            a.a3 * b.a0 + a.a4 * b.a3 + a.a5 * b.a6, a.a3 * b.a1 + a.a4 * b.a4 + a.a5 * b.a7, a.a3 * b.a2 + a.a4 * b.a5 + a.a5 * b.a8,
            a.a6 * b.a0 + a.a7 * b.a3 + a.a8 * b.a6, a.a6 * b.a1 + a.a7 * b.a4 + a.a8 * b.a7, a.a6 * b.a2 + a.a7 * b.a5 + a.a8 * b.a8)
    }

    /// Divide by H[2][2].
    public var normalized: Mat3 {
        let s = a8
        return Mat3(a0 / s, a1 / s, a2 / s, a3 / s, a4 / s, a5 / s, a6 / s, a7 / s, a8 / s)
    }

    public var isFinite: Bool {
        a0.isFinite && a1.isFinite && a2.isFinite && a3.isFinite && a4.isFinite && a5.isFinite && a6.isFinite
            && a7.isFinite && a8.isFinite
    }

    @inline(__always)
    public func apply(_ x: Double, _ y: Double) -> (Double, Double) {
        let qx = a0 * x + a1 * y + a2
        let qy = a3 * x + a4 * y + a5
        let qw = a6 * x + a7 * y + a8
        return (qx / qw, qy / qw)
    }
}

public struct Point: Equatable {
    public var x: Double
    public var y: Double
    public init(_ x: Double, _ y: Double) {
        self.x = x
        self.y = y
    }
}

@inline(__always)
public func fretU(_ n: Double) -> Double { 1.0 - pow(2.0, -n / 12.0) }

@inline(__always)
public func planePoint(_ u: Double, _ y: Double, tau: Double = defaultTau) -> Point {
    Point(u, (y - 0.5) * (1.0 + tau * u))
}

/// M = [[-1, 0, W-1], [0, 1, 0], [0, 0, 1]] (D1). Its own inverse.
public func mirrorMatrix(width: Int) -> Mat3 {
    Mat3(-1, 0, Double(width) - 1, 0, 1, 0, 0, 0, 1)
}

/// One keypoint: where fret wire `fret` meets the bass (side 0) or treble (side 1) edge.
public struct Anchor: Equatable {
    public var fret: Int
    public var side: Int
    public var x: Double
    public var y: Double
    public var conf: Double
    public init(fret: Int, side: Int, x: Double, y: Double, conf: Double = 1.0) {
        self.fret = fret
        self.side = side
        self.x = x
        self.y = y
        self.conf = conf
    }
    public var yCanon: Double { side == 0 ? 0.0 : 1.0 }
}

public struct FretboardModel {
    public var H: Mat3
    public var tau: Double
    public var nFrets: Int
    public var rmsePx: Double
    public var inlierCount: Int

    public init(H: Mat3, tau: Double = defaultTau, nFrets: Int = 24, rmsePx: Double = .nan, inlierCount: Int = 0) {
        self.H = H
        self.tau = tau
        self.nFrets = nFrets
        self.rmsePx = rmsePx
        self.inlierCount = inlierCount
    }

    @inline(__always)
    public func project(_ u: Double, _ y: Double) -> Point {
        let p = planePoint(u, y, tau: tau)
        let (x, yy) = H.apply(p.x, p.y)
        return Point(x, yy)
    }

    @inline(__always)
    public func projectFY(_ fret: Double, _ y: Double) -> Point { project(fretU(fret), y) }

    /// Image endpoints [bass, treble] of wire n (0 = nut).
    public func fretLine(_ n: Double) -> (Point, Point) { (projectFY(n, 0), projectFY(n, 1)) }

    public func fretWidthPx(_ n: Double, _ y: Double) -> Double {
        let a = projectFY(n, y), b = projectFY(n + 1, y)
        return hypot(b.x - a.x, b.y - a.y)
    }

    public func mirrored(width: Int) -> FretboardModel {
        var out = self
        out.H = mirrorMatrix(width: width) * H
        return out
    }
}

// MARK: - Linear algebra helpers

/// Right singular vector of the smallest singular value of a row-major (rows x n) matrix (one-sided Jacobi SVD).
/// Works for rows < n (returns a null-space vector). Returns nil if the input is not finite.
func smallestRightSingularVector(_ a: [Double], rows: Int, n: Int) -> [Double]? {
    if !a.allSatisfy({ $0.isFinite }) { return nil }
    // Column-major copy U (rows x n), V = I (n x n), column-major.
    var u = [Double](repeating: 0, count: rows * n)
    for r in 0..<rows {
        for c in 0..<n { u[c * rows + r] = a[r * n + c] }
    }
    var v = [Double](repeating: 0, count: n * n)
    for i in 0..<n { v[i * n + i] = 1 }
    let tol = 1e-15
    for _ in 0..<80 {
        var rotated = false
        for p in 0..<(n - 1) {
            for q in (p + 1)..<n {
                var alpha = 0.0, beta = 0.0, gamma = 0.0
                let po = p * rows, qo = q * rows
                for i in 0..<rows {
                    let up = u[po + i], uq = u[qo + i]
                    alpha += up * up
                    beta += uq * uq
                    gamma += up * uq
                }
                if gamma == 0 || abs(gamma) <= tol * (alpha * beta).squareRoot() { continue }
                rotated = true
                let zeta = (beta - alpha) / (2 * gamma)
                let t = (zeta >= 0 ? 1.0 : -1.0) / (abs(zeta) + (1 + zeta * zeta).squareRoot())
                let c = 1 / (1 + t * t).squareRoot()
                let s = c * t
                for i in 0..<rows {
                    let up = u[po + i], uq = u[qo + i]
                    u[po + i] = c * up - s * uq
                    u[qo + i] = s * up + c * uq
                }
                let pv = p * n, qv = q * n
                for i in 0..<n {
                    let vp = v[pv + i], vq = v[qv + i]
                    v[pv + i] = c * vp - s * vq
                    v[qv + i] = s * vp + c * vq
                }
            }
        }
        if !rotated { break }
    }
    var best = 0
    var bestNorm = Double.infinity
    for c in 0..<n {
        var s = 0.0
        for i in 0..<rows { s += u[c * rows + i] * u[c * rows + i] }
        if s < bestNorm {
            bestNorm = s
            best = c
        }
    }
    let out = Array(v[(best * n)..<(best * n + n)])
    return out.allSatisfy({ $0.isFinite }) ? out : nil
}

/// Solve A x = b (n x n, row-major) by Gaussian elimination with partial pivoting. nil if exactly singular
/// (mirrors numpy.linalg.solve raising LinAlgError).
func solveLinear(_ a: [Double], _ b: [Double], n: Int) -> [Double]? {
    var m = a
    var x = b
    for col in 0..<n {
        var piv = col
        var best = abs(m[col * n + col])
        for r in (col + 1)..<n where abs(m[r * n + col]) > best {
            best = abs(m[r * n + col])
            piv = r
        }
        if best == 0 { return nil }
        if piv != col {
            for c in 0..<n { m.swapAt(col * n + c, piv * n + c) }
            x.swapAt(col, piv)
        }
        let d = m[col * n + col]
        for r in (col + 1)..<n {
            let f = m[r * n + col] / d
            if f == 0 { continue }
            for c in col..<n { m[r * n + c] -= f * m[col * n + c] }
            x[r] -= f * x[col]
        }
    }
    for r in stride(from: n - 1, through: 0, by: -1) {
        var s = x[r]
        for c in (r + 1)..<n { s -= m[r * n + c] * x[c] }
        x[r] = s / m[r * n + r]
    }
    return x
}

/// numpy.median (mean of the two middle values for even counts). NaN for empty input.
func median(_ values: [Double]) -> Double {
    if values.isEmpty { return .nan }
    if values.contains(where: { $0.isNaN }) { return .nan }
    let s = values.sorted()
    let k = s.count / 2
    return s.count % 2 == 1 ? s[k] : (s[k - 1] + s[k]) / 2
}

// MARK: - Homography estimation

private func hartley(_ pts: [Point]) -> (Mat3, [Point]) {
    var cx = 0.0, cy = 0.0
    for p in pts {
        cx += p.x
        cy += p.y
    }
    cx /= Double(pts.count)
    cy /= Double(pts.count)
    var d = 0.0
    for p in pts { d += ((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)).squareRoot() }
    d /= Double(pts.count)
    let s = 2.0.squareRoot() / max(d, 1e-12)
    let T = Mat3(s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1)
    return (T, pts.map { Point(s * $0.x - s * cx, s * $0.y - s * cy) })
}

private func hartleyInverse(_ T: Mat3) -> Mat3 {
    let s = T.a0
    return Mat3(1 / s, 0, -T.a2 / s, 0, 1 / s, -T.a5 / s, 0, 0, 1)
}

/// Weighted, Hartley-normalized DLT homography src -> dst (N >= 4), normalized so H[2][2] = 1. nil if degenerate.
public func dlt(_ src: [Point], _ dst: [Point], weights: [Double]? = nil) -> Mat3? {
    let n = src.count
    guard n >= 4, dst.count == n else { return nil }
    let (Ts, s) = hartley(src)
    let (Td, d) = hartley(dst)
    var rows = [Double](repeating: 0, count: 2 * n * 9)
    for i in 0..<n {
        let x = s[i].x, y = s[i].y, u = d[i].x, v = d[i].y
        let sw = weights.map { $0[i].squareRoot() } ?? 1.0
        let r0 = 2 * i * 9, r1 = r0 + 9
        let a: [Double] = [-x, -y, -1, 0, 0, 0, u * x, u * y, u]
        let b: [Double] = [0, 0, 0, -x, -y, -1, v * x, v * y, v]
        for k in 0..<9 {
            rows[r0 + k] = a[k] * sw
            rows[r1 + k] = b[k] * sw
        }
    }
    guard let h = smallestRightSingularVector(rows, rows: 2 * n, n: 9) else { return nil }
    let H = (hartleyInverse(Td) * Mat3(h) * Ts).normalized
    return H.isFinite ? H : nil
}

/// Gauss-Newton / IRLS on reprojection error with a Huber loss (8 params, H[2,2] = 1); numerical Jacobian like gro.
func refineHomography(_ H0: Mat3, src: [Point], dst: [Point], w: [Double], huberPx: Double, iters: Int = 15) -> Mat3 {
    var h = Array(H0.normalized.m[0..<8])
    let n = src.count
    let m2 = 2 * n
    var r = [Double](repeating: 0, count: m2)
    var rp = [Double](repeating: 0, count: m2)
    var wr = [Double](repeating: 0, count: m2)
    var J = [Double](repeating: 0, count: m2 * 8)  // row-major (2n x 8)
    var A = [Double](repeating: 0, count: 64)
    var g = [Double](repeating: 0, count: 8)
    var hp = h
    func residuals(_ hv: [Double], _ out: inout [Double]) {
        let Hm = Mat3(hv[0], hv[1], hv[2], hv[3], hv[4], hv[5], hv[6], hv[7], 1.0)
        for i in 0..<n {
            let (x, y) = Hm.apply(src[i].x, src[i].y)
            out[2 * i] = x - dst[i].x
            out[2 * i + 1] = y - dst[i].y
        }
    }
    for _ in 0..<iters {
        residuals(h, &r)
        for i in 0..<n {
            let rn = (r[2 * i] * r[2 * i] + r[2 * i + 1] * r[2 * i + 1]).squareRoot()
            let hub = rn <= huberPx ? 1.0 : huberPx / max(rn, 1e-12)
            wr[2 * i] = w[i] * hub
            wr[2 * i + 1] = w[i] * hub
        }
        for k in 0..<8 {
            let eps = 1e-7 * max(1.0, abs(h[k]))
            hp = h
            hp[k] += eps
            residuals(hp, &rp)
            for j in 0..<m2 { J[j * 8 + k] = (rp[j] - r[j]) / eps }
        }
        for a in 0..<64 { A[a] = 0 }
        for a in 0..<8 { g[a] = 0 }
        for j in 0..<m2 {
            let wj = wr[j]
            let base = j * 8
            let wrj = wj * r[j]
            for a in 0..<8 {
                let ja = J[base + a]
                g[a] += ja * wrj
                let jaw = ja * wj
                for b in a..<8 { A[a * 8 + b] += jaw * J[base + b] }
            }
        }
        for a in 0..<8 { for b in 0..<a { A[a * 8 + b] = A[b * 8 + a] } }
        var trace = 0.0
        for a in 0..<8 { trace += A[a * 8 + a] }
        for a in 0..<8 { A[a * 8 + a] += 1e-9 * trace }
        for a in 0..<8 { g[a] = -g[a] }
        guard let step = solveLinear(A, g, n: 8) else { break }
        var maxStep = 0.0
        for k in 0..<8 {
            h[k] += step[k]
            maxStep = max(maxStep, abs(step[k]))
        }
        if maxStep < 1e-12 { break }
    }
    return Mat3(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0)
}

/// Homography from exactly 4 correspondences (Hartley-normalized, h22 = 1 linear solve). For a minimal sample this is
/// the same null vector the SVD-based DLT returns (gro's _dlt_batch). No heap allocation. nil if singular/non-finite.
@inline(__always)
func homography4(_ sx: (Double, Double, Double, Double), _ sy: (Double, Double, Double, Double),
                 _ dx: (Double, Double, Double, Double), _ dy: (Double, Double, Double, Double)) -> Mat3?
{
    func norm(_ x: (Double, Double, Double, Double), _ y: (Double, Double, Double, Double))
        -> (Double, Double, Double, (Double, Double, Double, Double), (Double, Double, Double, Double))
    {
        let cx = (x.0 + x.1 + x.2 + x.3) / 4, cy = (y.0 + y.1 + y.2 + y.3) / 4
        let d = (hypot(x.0 - cx, y.0 - cy) + hypot(x.1 - cx, y.1 - cy) + hypot(x.2 - cx, y.2 - cy)
            + hypot(x.3 - cx, y.3 - cy)) / 4
        let s = 2.0.squareRoot() / max(d, 1e-12)
        return (s, cx, cy, ((x.0 - cx) * s, (x.1 - cx) * s, (x.2 - cx) * s, (x.3 - cx) * s),
                ((y.0 - cy) * s, (y.1 - cy) * s, (y.2 - cy) * s, (y.3 - cy) * s))
    }
    let (ss, scx, scy, nx, ny) = norm(sx, sy)
    let (ds, dcx, dcy, nu, nv) = norm(dx, dy)
    return withUnsafeTemporaryAllocation(of: Double.self, capacity: 72) { m -> Mat3? in
        // 8 x 9 augmented system [A | b]: A h = b with h8 = 1
        for i in 0..<4 {
            let x: Double, y: Double, u: Double, v: Double
            switch i {
            case 0: (x, y, u, v) = (nx.0, ny.0, nu.0, nv.0)
            case 1: (x, y, u, v) = (nx.1, ny.1, nu.1, nv.1)
            case 2: (x, y, u, v) = (nx.2, ny.2, nu.2, nv.2)
            default: (x, y, u, v) = (nx.3, ny.3, nu.3, nv.3)
            }
            let r0 = 2 * i * 9, r1 = r0 + 9
            m[r0 + 0] = -x; m[r0 + 1] = -y; m[r0 + 2] = -1; m[r0 + 3] = 0; m[r0 + 4] = 0; m[r0 + 5] = 0
            m[r0 + 6] = u * x; m[r0 + 7] = u * y; m[r0 + 8] = -u
            m[r1 + 0] = 0; m[r1 + 1] = 0; m[r1 + 2] = 0; m[r1 + 3] = -x; m[r1 + 4] = -y; m[r1 + 5] = -1
            m[r1 + 6] = v * x; m[r1 + 7] = v * y; m[r1 + 8] = -v
        }
        for col in 0..<8 {
            var piv = col
            var best = abs(m[col * 9 + col])
            for r in (col + 1)..<8 where abs(m[r * 9 + col]) > best {
                best = abs(m[r * 9 + col])
                piv = r
            }
            if !(best > 1e-12) { return nil }
            if piv != col { for c in col..<9 { let t = m[col * 9 + c]; m[col * 9 + c] = m[piv * 9 + c]; m[piv * 9 + c] = t } }
            let d = m[col * 9 + col]
            for r in (col + 1)..<8 {
                let f = m[r * 9 + col] / d
                if f == 0 { continue }
                for c in col..<9 { m[r * 9 + c] -= f * m[col * 9 + c] }
            }
        }
        var h = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        withUnsafeMutableBytes(of: &h) { hb in
            let hh = hb.bindMemory(to: Double.self)
            for r in stride(from: 7, through: 0, by: -1) {
                var s = m[r * 9 + 8]
                for c in (r + 1)..<8 { s -= m[r * 9 + c] * hh[c] }
                hh[r] = s / m[r * 9 + r]
            }
        }
        let Hn = Mat3(h.0, h.1, h.2, h.3, h.4, h.5, h.6, h.7, 1)
        let Ts = Mat3(ss, 0, -ss * scx, 0, ss, -ss * scy, 0, 0, 1)
        let TdInv = Mat3(1 / ds, 0, dcx, 0, 1 / ds, dcy, 0, 0, 1)
        let H = (TdInv * Hn * Ts).normalized
        return H.isFinite ? H : nil
    }
}

// MARK: - RANSAC fit

/// Deterministic SplitMix64 generator (RANSAC sampling). Not bit-compatible with numpy.
public struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }
    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

func isDegenerate(_ anchors: [Anchor]) -> Bool {
    Set(anchors.map(\.fret)).count < 2 || Set(anchors.map(\.side)).count < 2
}

func sampleOK(_ sample: [Anchor]) -> Bool {
    if isDegenerate(sample) { return false }
    if Set(sample.map { $0.fret * 2 + $0.side }).count < sample.count { return false }
    return sample.filter { $0.side == 0 }.count <= 2 && sample.filter { $0.side == 1 }.count <= 2
}

public enum FitError: Error, Equatable {
    case tooFewAnchors
}

/// Robust fit of the fretboard model (gro.geometry.fit_fretboard with fixed tau): RANSAC over 4-point samples with a
/// MSAC cost (inlier threshold = inlierFrac x local fret width, >= minInlierPx), then Huber-IRLS refinement on the
/// inliers, re-evaluating the inlier set until it is stable.
public func fitFretboard(
    _ anchors: [Anchor],
    tau: Double = defaultTau,
    nFrets: Int = 24,
    ransacIters: Int = 300,
    inlierFrac: Double = 0.15,
    minInlierPx: Double = 2.0,
    seed: UInt64 = 0,
    ransacSamples: [[Int]]? = nil
) throws -> FretboardModel {
    if anchors.count < 4 || isDegenerate(anchors) { throw FitError.tooFewAnchors }
    let n = anchors.count
    let aFret = anchors.map { Double($0.fret) }
    let aY = anchors.map(\.yCanon)
    let src = (0..<n).map { planePoint(fretU(aFret[$0]), aY[$0], tau: tau) }
    let dst = anchors.map { Point($0.x, $0.y) }
    let w = anchors.map(\.conf)
    let p1 = (0..<n).map { planePoint(fretU(aFret[$0] + 1), aY[$0], tau: tau) }

    // Inliers and MSAC cost of H over all anchors; nil if any residual / fret width is not finite.
    func evaluate(_ H: Mat3) -> (inl: [Bool], count: Int, cost: Double)? {
        var inl = [Bool](repeating: false, count: n)
        var count = 0
        var cost = 0.0
        for i in 0..<n {
            let (x, y) = H.apply(src[i].x, src[i].y)
            let r = hypot(x - dst[i].x, y - dst[i].y)
            let (ax, ay) = H.apply(p1[i].x, p1[i].y)
            let fw = hypot(ax - x, ay - y)
            if !r.isFinite || !fw.isFinite { return nil }
            let thr = max(inlierFrac * fw, minInlierPx)
            if r < thr {
                inl[i] = true
                count += 1
            }
            let q = min(r / thr, 1.0)
            cost += q * q
        }
        return (inl, count, cost)
    }

    var bestInl: [Bool]? = nil
    if n == 4 {
        bestInl = [Bool](repeating: true, count: n)
    } else {
        var rng = SplitMix64(seed: seed)
        var bestCost = Double.infinity
        var bestH: Mat3? = nil
        var idx = Array(0..<n)
        let sX = src.map(\.x), sY = src.map(\.y), dX = dst.map(\.x), dY = dst.map(\.y)
        let qX = p1.map(\.x), qY = p1.map(\.y)
        let side = anchors.map(\.side), slot = anchors.map { $0.fret * 2 + $0.side }
        for iteration in 0..<ransacIters {
            // partial Fisher-Yates: 4 distinct indices
            if let samples = ransacSamples {
                precondition(samples.count >= ransacIters && samples[iteration].count == 4)
                for k in 0..<4 { idx[k] = samples[iteration][k] }
            } else {
                for k in 0..<4 {
                    let j = k + Int(rng.next() % UInt64(n - k))
                    idx.swapAt(k, j)
                }
            }
            let i0 = idx[0], i1 = idx[1], i2 = idx[2], i3 = idx[3]
            // _sample_ok for 4 points: exactly 2 per edge (=> 2+ frets) and no duplicate slot
            if side[i0] + side[i1] + side[i2] + side[i3] != 2 { continue }
            let s0 = slot[i0], s1 = slot[i1], s2 = slot[i2], s3 = slot[i3]
            if s0 == s1 || s0 == s2 || s0 == s3 || s1 == s2 || s1 == s3 || s2 == s3 { continue }
            guard let H = homography4((sX[i0], sX[i1], sX[i2], sX[i3]), (sY[i0], sY[i1], sY[i2], sY[i3]),
                                      (dX[i0], dX[i1], dX[i2], dX[i3]), (dY[i0], dY[i1], dY[i2], dY[i3]))
            else { continue }
            var count = 0
            var cost = 0.0
            var ok = true
            for i in 0..<n {
                let (x, y) = H.apply(sX[i], sY[i])
                let ex = x - dX[i], ey = y - dY[i]
                let r = (ex * ex + ey * ey).squareRoot()
                let (ax, ay) = H.apply(qX[i], qY[i])
                let fx = ax - x, fy = ay - y
                let fw = (fx * fx + fy * fy).squareRoot()
                if !r.isFinite || !fw.isFinite {
                    ok = false
                    break
                }
                let thr = max(inlierFrac * fw, minInlierPx)
                if r < thr { count += 1 }
                let q = min(r / thr, 1.0)
                cost += q * q
                if cost >= bestCost {  // MSAC cost only grows: cannot beat the best (strict <)
                    ok = false
                    break
                }
            }
            if ok && count >= 4 && cost < bestCost {
                bestCost = cost
                bestH = H
            }
        }
        if let bestH { bestInl = evaluate(bestH)?.inl }
        if let b = bestInl, isDegenerate((0..<n).filter { b[$0] }.map { anchors[$0] }) { bestInl = nil }
        if bestInl == nil { bestInl = [Bool](repeating: true, count: n) }
    }
    var inl = bestInl!

    var H = Mat3.identity
    var haveH = false
    for _ in 0..<10 {
        let sel = (0..<n).filter { inl[$0] }
        guard let H0 = dlt(sel.map { src[$0] }, sel.map { dst[$0] }, weights: sel.map { w[$0] }) else {
            if !haveH { throw FitError.tooFewAnchors }  // LinAlgError in numpy -> safe_fit returns None
            break
        }
        let m0 = FretboardModel(H: H0, tau: tau, nFrets: nFrets)
        let huber = max(minInlierPx, 0.1 * median(sel.map { m0.fretWidthPx(aFret[$0], 0.5) }))
        H = refineHomography(H0, src: sel.map { src[$0] }, dst: sel.map { dst[$0] }, w: sel.map { w[$0] }, huberPx: huber)
        haveH = true
        guard let sc = evaluate(H) else { break }
        let newInl = sc.inl
        if sc.count < 4 || isDegenerate((0..<n).filter { newInl[$0] }.map { anchors[$0] }) || newInl == inl { break }
        inl = newInl
    }

    let sel = (0..<n).filter { inl[$0] }
    var se = 0.0
    for i in sel {
        let (x, y) = H.apply(src[i].x, src[i].y)
        se += (x - dst[i].x) * (x - dst[i].x) + (y - dst[i].y) * (y - dst[i].y)
    }
    let rmse = sel.isEmpty ? Double.nan : (se / Double(sel.count)).squareRoot()
    return FretboardModel(H: H, tau: tau, nFrets: nFrets, rmsePx: rmse, inlierCount: sel.count)
}

/// fit_fretboard wrapped like gro.infer.tracker.safe_fit: nil on any failure or non-finite result.
public func safeFit(_ anchors: [Anchor], nFrets: Int = 24) -> FretboardModel? {
    guard let m = try? fitFretboard(anchors, nFrets: nFrets) else { return nil }
    return m.H.isFinite && m.rmsePx.isFinite ? m : nil
}
