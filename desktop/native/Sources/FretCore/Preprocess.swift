import Foundation

// Port of gro.infer.preprocess: letterbox placement (ultralytics rounding) and decoding of the raw pose head output.

public let nKpts = 50
public let modelInputSize = 640
public let letterboxPadValue: UInt8 = 114

/// Python's round(): half to even.
@inline(__always)
func pyRound(_ x: Double) -> Int { Int(x.rounded(.toNearestOrEven)) }

/// Placement of an (h, w) frame inside the square network input (same rounding as ultralytics LetterBox).
public struct Letterbox: Equatable {
    public let size: Int
    public let h: Int
    public let w: Int
    public let newW: Int
    public let newH: Int
    public let left: Int
    public let top: Int

    public init(width: Int, height: Int, size: Int = modelInputSize) {
        let r = min(Double(size) / Double(height), Double(size) / Double(width))
        let nw = pyRound(Double(width) * r), nh = pyRound(Double(height) * r)
        self.size = size
        self.w = width
        self.h = height
        self.newW = nw
        self.newH = nh
        self.left = pyRound(Double(size - nw) / 2 - 0.1)
        self.top = pyRound(Double(size - nh) / 2 - 0.1)
    }

    /// Letterboxed input px -> frame px (float32 arithmetic like numpy); `clip` clamps to [0, w] x [0, h].
    public func toFrame(x: Float, y: Float, clip: Bool = true) -> (Float, Float) {
        var fx = (x - Float(left)) / Float(Double(newW) / Double(w))
        var fy = (y - Float(top)) / Float(Double(newH) / Double(h))
        if clip {
            fx = min(max(fx, 0), Float(w))
            fy = min(max(fy, 0), Float(h))
        }
        return (fx, fy)
    }

    /// Frame px -> letterboxed input px (inverse of `toFrame` without clipping).
    @inline(__always)
    public func toLetterbox(x: Double, y: Double) -> (Double, Double) {
        (x * Double(newW) / Double(w) + Double(left), y * Double(newH) / Double(h) + Double(top))
    }
}

public struct Detection {
    /// 50 x (x, y, conf) in letterboxed px, row-major (150 values). NaN if no board.
    public var kpts: [Float]
    public var score: Float
}

/// Best detection from a raw (155, A) channel-major head output accessed through `value(channel, anchor)`.
/// argmax of the score channel (first maximum); below `confThr` the keypoints are NaN and the score is kept.
public func decode(anchorCount: Int, confThr: Float = 0.25, value: (Int, Int) -> Float) -> Detection {
    var best = 0
    var bestScore = -Float.infinity
    for a in 0..<anchorCount {
        let s = value(4, a)
        if s > bestScore || (s.isNaN && !bestScore.isNaN) {
            bestScore = s
            best = a
            if s.isNaN { break }  // numpy argmax returns the first NaN
        }
    }
    if !(bestScore >= confThr) {
        return Detection(kpts: [Float](repeating: .nan, count: nKpts * 3), score: bestScore)
    }
    return Detection(kpts: (0..<(nKpts * 3)).map { value(5 + $0, best) }, score: bestScore)
}

/// Decode from a contiguous channel-major float buffer (155 x anchorCount).
public func decode(raw: [Float], anchorCount: Int, confThr: Float = 0.25) -> Detection {
    decode(anchorCount: anchorCount, confThr: confThr) { c, a in raw[c * anchorCount + a] }
}

/// Unletterbox decoded keypoints (only if every x is finite, like the Python tracker).
public func unletterbox(_ kpts: [Float], _ lb: Letterbox, clip: Bool = true) -> [Float] {
    var out = kpts
    if (0..<nKpts).allSatisfy({ kpts[$0 * 3].isFinite }) {
        for i in 0..<nKpts {
            let (x, y) = lb.toFrame(x: kpts[i * 3], y: kpts[i * 3 + 1], clip: clip)
            out[i * 3] = x
            out[i * 3 + 1] = y
        }
    }
    return out
}

/// Anchors from 50 x (x, y, conf) keypoints: conf > thr (absolute slots 0b, 0t, ..., 24t).
public func anchorsFrom(_ kpts: [Float], thr: Float = 0.5, maxFret: Int = 24) -> [Anchor] {
    var out: [Anchor] = []
    for i in 0..<nKpts {
        let c = kpts[i * 3 + 2]
        if c.isFinite && c > thr && i / 2 <= maxFret {
            out.append(Anchor(fret: i / 2, side: i % 2, x: Double(kpts[i * 3]), y: Double(kpts[i * 3 + 1]), conf: Double(c)))
        }
    }
    return out
}
