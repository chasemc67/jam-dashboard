import Foundation

// Port of gro.board_end: ridge test for fret wires beyond the fit and the per-clip fret-count vote.

public let firstTestedFret = 19
public let refFrets = 14...18
public let pxPerCell = 24

/// 8-bit grayscale image plus the mapping from canonical source-frame px to image px.
///
/// The Swift helper only has the 640x640 letterboxed frame, so source px (x, y) are sampled at
/// (x * scaleX + offsetX, y * scaleY + offsetY) (pixel-centre resize mapping, see init(letterboxed:)) and "inside" means inside the content rectangle
/// [contentX, contentX + contentW - 1) x [contentY, contentY + contentH - 1) (cv2.remap-style neighbourhood).
public struct GrayImage {
    public let width: Int
    public let height: Int
    /// Gray (bytesPerPixel 1) or RGBA8 (bytesPerPixel 4, converted to gray per sample like cv2 BGR2GRAY).
    public let pixels: [UInt8]
    public let bytesPerPixel: Int
    public let scaleX: Double, scaleY: Double, offsetX: Double, offsetY: Double
    public let contentX: Double, contentY: Double, contentW: Double, contentH: Double

    /// Identity mapping over the whole image (Python behaviour on a full-resolution frame).
    public init(width: Int, height: Int, pixels: [UInt8]) {
        self.width = width
        self.height = height
        self.pixels = pixels
        bytesPerPixel = 1
        scaleX = 1
        scaleY = 1
        offsetX = 0
        offsetY = 0
        contentX = 0
        contentY = 0
        contentW = Double(width)
        contentH = Double(height)
    }

    /// Letterboxed gray image (lb.size square) sampled with source-frame coordinates.
    /// `rgba`: true if `pixels` is RGBA8 (gray computed only where sampled).
    public init(letterboxed pixels: [UInt8], letterbox lb: Letterbox, rgba: Bool = false) {
        width = lb.size
        height = lb.size
        self.pixels = pixels
        bytesPerPixel = rgba ? 4 : 1
        scaleX = Double(lb.newW) / Double(lb.w)
        scaleY = Double(lb.newH) / Double(lb.h)
        // pixel-centre mapping of cv2.resize INTER_LINEAR: dst = (src + 0.5) * scale - 0.5 (+ pad offset). Measured on
        // the Stan clip it makes the letterbox ridge test agree better with the full-res one than src * scale + pad.
        offsetX = Double(lb.left) + 0.5 * scaleX - 0.5
        offsetY = Double(lb.top) + 0.5 * scaleY - 0.5
        contentX = Double(lb.left)
        contentY = Double(lb.top)
        contentW = Double(lb.newW)
        contentH = Double(lb.newH)
    }

    /// OpenCV BGR2GRAY on RGBA8 (fixed point, same rounding as cv2).
    public static func grayFromRGBA(_ rgba: UnsafeRawBufferPointer, count: Int) -> [UInt8] {
        var out = [UInt8](repeating: 0, count: count)
        let p = rgba.bindMemory(to: UInt8.self)
        for i in 0..<count {
            let r = UInt32(p[i * 4]), g = UInt32(p[i * 4 + 1]), b = UInt32(p[i * 4 + 2])
            out[i] = UInt8((r * 4899 + g * 9617 + b * 1868 + 8192) >> 14)
        }
        return out
    }

    /// Bilinear sample like cv2.remap(INTER_LINEAR, BORDER_CONSTANT 0): coordinates quantized to 1/32 px, result
    /// rounded to uint8. `x`, `y` are already in image px.
    @inline(__always)
    func sample(_ x: Double, _ y: Double) -> Float {
        guard x.isFinite, y.isFinite, abs(x) < 1e7, abs(y) < 1e7 else { return 0 }
        let X = Int((x * 32).rounded()), Y = Int((y * 32).rounded())
        let ix = X >> 5, iy = Y >> 5
        let fx = Double(X & 31) / 32, fy = Double(Y & 31) / 32
        func px(_ cx: Int, _ cy: Int) -> Double {
            guard cx >= 0 && cy >= 0 && cx < width && cy < height else { return 0 }
            if bytesPerPixel == 1 { return Double(pixels[cy * width + cx]) }
            let o = (cy * width + cx) * 4
            let r = UInt32(pixels[o]), g = UInt32(pixels[o + 1]), b = UInt32(pixels[o + 2])
            return Double((r * 4899 + g * 9617 + b * 1868 + 8192) >> 14)
        }
        let v = (1 - fy) * ((1 - fx) * px(ix, iy) + fx * px(ix + 1, iy)) + fy * ((1 - fx) * px(ix, iy + 1) + fx * px(ix + 1, iy + 1))
        return Float(min(255, max(0, v.rounded())))
    }
}

/// Gray strip sampled on canonical (fret, y) with y in [0.1, 0.9]; columns uniform in fret number.
/// Returns (strip rows x cols row-major, inside mask, cols).
func rectifyStrip(_ img: GrayImage, _ model: FretboardModel, fLo: Double, fHi: Double, rows: Int = 24)
    -> (strip: [Float], inside: [Bool], cols: Int)
{
    let cols = pyRound((fHi - fLo) * Double(pxPerCell))
    var strip = [Float](repeating: 0, count: rows * cols)
    var inside = [Bool](repeating: false, count: rows * cols)
    let fStep = cols > 1 ? (fHi - fLo) / Double(cols - 1) : 0
    let yStep = rows > 1 ? (0.9 - 0.1) / Double(rows - 1) : 0
    let x0 = img.contentX, x1 = img.contentX + img.contentW - 1
    let y0 = img.contentY, y1 = img.contentY + img.contentH - 1
    for c in 0..<cols {
        let f = c == cols - 1 ? fHi : fLo + Double(c) * fStep
        let u = fretU(f)
        for r in 0..<rows {
            let yy = r == rows - 1 ? 0.9 : 0.1 + Double(r) * yStep
            let p = model.project(u, yy)
            // cv2.remap takes float32 maps
            let sx = Double(Float(p.x)), sy = Double(Float(p.y))
            let ix = sx * img.scaleX + img.offsetX, iy = sy * img.scaleY + img.offsetY
            strip[r * cols + c] = img.sample(ix, iy)
            inside[r * cols + c] = ix >= x0 && ix < x1 && iy >= y0 && iy < y1
        }
    }
    return (strip, inside, cols)
}

/// Ridge strength at each wire 14...nMax, normalized by the median strength of the reference wires 14..18.
/// Missing keys = wire not (fully) in view. Only wires >= 19 are returned.
public func ridgeScores(_ img: GrayImage, _ model: FretboardModel, nMax: Int = 24) -> [Int: Double] {
    let fLo = Double(refFrets.lowerBound) - 0.5, fHi = Double(nMax) + 0.5
    let rows = 24
    let (strip, inside, cols) = rectifyStrip(img, model, fLo: fLo, fHi: fHi, rows: rows)
    let half = rows / 2
    let d = pxPerCell / 4
    let search = max(2, pxPerCell / 6)
    // column means of each half (float32 like numpy)
    var top = [Float](repeating: 0, count: cols), bot = [Float](repeating: 0, count: cols)
    for c in 0..<cols {
        var a: Float = 0, b: Float = 0
        for r in 0..<half { a += strip[r * cols + c] }
        for r in half..<rows { b += strip[r * cols + c] }
        top[c] = a / Float(half)
        bot[c] = b / Float(rows - half)
    }
    var raw: [Int: Double] = [:]
    for n in refFrets.lowerBound...nMax {
        let c = pyRound((Double(n) - fLo) * Double(pxPerCell))
        let lo = c - search - d, hi = c + search + d
        if lo < 0 || hi >= cols { continue }
        var allInside = true
        outer: for r in 0..<rows {
            for col in lo...hi where !inside[r * cols + col] {
                allInside = false
                break outer
            }
        }
        if !allInside { continue }
        var best = -Double.infinity
        for x in (c - search)...(c + search) {
            let s0 = min(top[x] - top[x - d], top[x] - top[x + d])
            let s1 = min(bot[x] - bot[x - d], bot[x] - bot[x + d])
            best = max(best, Double(min(s0, s1)))
        }
        raw[n] = best
    }
    let ref = refFrets.compactMap { raw[$0] }
    if ref.count < 3 { return [:] }
    let r = median(ref)
    if !(r > 1.0) { return [:] }
    var out: [Int: Double] = [:]
    for (n, v) in raw where n >= firstTestedFret { out[n] = v / r }
    return out
}

/// Last fret supported in this frame, or nil if the evidence is incomplete. `conf`: 25 min-over-sides confidences.
public func frameLastFret(_ ridge: [Int: Double], conf: [Double]? = nil, thr: Double = 0.35) -> Int? {
    var n = firstTestedFret
    while n <= 24 {
        guard let rv = ridge[n] else { return nil }
        var c = 0.0
        if let conf, conf[n].isFinite { c = conf[n] }
        if !(rv >= thr || (c > 0.5 && rv >= thr / 2)) { break }
        n += 1
    }
    let last = n - 1
    if last < 24 && ridge[last + 1] == nil { return nil }
    return last >= 20 ? last : nil
}

/// Per-clip fret count: running vote with hysteresis plus the startup cap (gro.board_end.FretCountVote).
public struct FretCountVote {
    public private(set) var votes: [Int: Int] = [:]
    private var voteOrder: [Int] = []  // insertion order (Counter.most_common tie-break)
    public private(set) var value: Int
    public let override: Int?
    public let minVotes: Int
    public let margin: Int
    public let capThr: Double
    public let capFrames: Int
    public private(set) var caps: [Int: Int] = [:]

    public init(default def: Int = 24, minVotes: Int = 15, margin: Int = 10, override: Int? = nil,
                capThr: Double = 0.5, capFrames: Int = 3)
    {
        let ov = (override ?? 0) != 0 ? override : nil
        self.override = ov
        value = ov ?? def
        self.minVotes = minVotes
        self.margin = margin
        self.capThr = capThr
        self.capFrames = capFrames
    }

    public var totalVotes: Int { votes.values.reduce(0, +) }

    @discardableResult
    public mutating func update(_ estimate: Int?) -> Int {
        guard override == nil, let e = estimate else { return value }
        if votes[e] == nil { voteOrder.append(e) }
        votes[e, default: 0] += 1
        if totalVotes >= minVotes {
            var mode = voteOrder[0], count = votes[mode]!
            for k in voteOrder where votes[k]! > count {
                mode = k
                count = votes[k]!
            }
            if mode != value && count >= votes[value, default: 0] + margin { value = mode }
        }
        return value
    }

    public var settled: Bool {
        if override != nil { return true }
        let n = totalVotes
        return n >= minVotes && votes[value, default: 0] == (votes.values.max() ?? 0)
    }

    public mutating func observeConf(_ conf: [Double]) {
        if settled { return }
        var last = -1
        for (i, c) in conf.enumerated() where c.isFinite && c > capThr { last = i }
        if last >= 12 { caps[last, default: 0] += 1 }
    }

    public var cap: Int? {
        if caps.isEmpty { return nil }
        let need = min(capFrames, caps.values.reduce(0, +))
        var total = 0
        for f in caps.keys.sorted(by: >) {
            total += caps[f]!
            if total >= need { return f }
        }
        return nil
    }

    public var shown: Int {
        let c = settled ? nil : cap
        return c.map { min(value, $0) } ?? value
    }
}
