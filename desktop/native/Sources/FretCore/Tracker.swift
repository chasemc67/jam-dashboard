import Foundation

// Port of gro.infer.tracker.FretboardTracker.update: board-end probe + vote, RANSAC fit, One-Euro, hold, mirror.

public let endFitMaxFret = 21  // board-end probe fit ignores slots that may sit on the pickups of a 21/22-fret guitar

public struct TrackState {
    public var t: Double
    public var valid: Bool
    /// Smoothed fit in original-frame px (mirror composed in).
    public var model: FretboardModel?
    public var nFrets: Int
    /// 50 x (x, y, conf) raw keypoints in original-frame px.
    public var kpts: [Float]
    public var boardScore: Double = 0
    public var anchorCount: Int
    public var endEstimate: Int?
    public var held: Bool
    public var rmsePx: Double

    /// (nFrets + 1) wires [bass end, treble end], wire 0 = nut. Empty if not valid.
    public func wires() -> [(Point, Point)] {
        guard let model else { return [] }
        return (0...nFrets).map { model.fretLine(Double($0)) }
    }
}

public final class FretboardTracker {
    public var frets: Int?
    public let fps: Double
    public let smooth: Bool
    public let kptThr: Float
    public let hold: Int
    public let endEvery: Int
    public let settledVotes: Int
    let minCutoff: Double, beta: Double, speedFloor: Double

    public private(set) var vote = FretCountVote()
    public private(set) var filter: OneEuroModel?
    public private(set) var canonModel: FretboardModel?
    public private(set) var missed = 0
    public private(set) var lastT: Double?
    public private(set) var frameIndex = 0

    public init(frets: Int? = nil, fps: Double = 30, smooth: Bool = true, kptThr: Float = 0.5, hold: Int = 10,
                minCutoff: Double = 0.4, beta: Double = 3.0, speedFloor: Double = 2.0, endEvery: Int = 10,
                settledVotes: Int = 60)
    {
        self.frets = (frets ?? 0) > 0 ? frets : nil
        self.fps = fps
        self.smooth = smooth
        self.kptThr = kptThr
        self.hold = hold
        self.minCutoff = minCutoff
        self.beta = beta
        self.speedFloor = speedFloor
        self.endEvery = max(1, endEvery)
        self.settledVotes = settledVotes
        reset()
    }

    public func reset() {
        vote = FretCountVote(override: frets)
        filter = smooth ? OneEuroModel(fps: fps, minCutoff: minCutoff, beta: beta, speedFloor: speedFloor) : nil
        canonModel = nil
        missed = 0
        lastT = nil
        frameIndex = 0
    }

    /// Post-process one frame's canonical keypoints (50 x (x, y, conf), canonical frame px).
    /// - gray: lazily provides the canonical grayscale image for the board-end ridge test.
    /// - width/height: canonical (= original) frame size; mirrored: compose the mirror into the outputs.
    public func update(kpts k: [Float], width: Int, height: Int, mirrored: Bool, t tIn: Double?,
                       gray: () -> GrayImage?) -> TrackState
    {
        var dt: Double? = nil
        if let tIn, let lastT { dt = tIn - lastT }
        let t = tIn ?? (lastT.map { $0 + 1.0 / fps } ?? 0.0)
        lastT = t

        let anchors = anchorsFrom(k, thr: kptThr)
        var estimate: Int? = nil
        let settled = vote.totalVotes >= settledVotes
        frameIndex += 1
        var conf: [Double]? = nil
        if (0..<nKpts).contains(where: { k[$0 * 3 + 2].isFinite }) {
            conf = (0..<25).map { f in
                let a = Double(k[(2 * f) * 3 + 2]), b = Double(k[(2 * f + 1) * 3 + 2])
                if a.isNaN { return b }
                if b.isNaN { return a }
                return min(a, b)
            }
        }
        if frets == nil && (!settled || frameIndex % endEvery == 0) {
            if let probe = safeFit(anchors.filter { $0.fret <= endFitMaxFret }), let img = gray() {
                estimate = frameLastFret(ridgeScores(img, probe), conf: conf)
            }
        }
        vote.update(estimate)
        if let conf { vote.observeConf(conf) }
        let nFrets = vote.shown

        let fit = safeFit(anchors.filter { $0.fret <= nFrets }, nFrets: nFrets)
        if let fit {
            missed = 0
            if filter != nil {
                canonModel = filter!.update(fit, width: width, height: height, dt: dt)
            } else {
                canonModel = fit
            }
        } else {
            missed += 1
            if missed > hold {
                canonModel = nil
                filter?.reset()
            }
        }

        var model = canonModel
        if let m = model, mirrored { model = m.mirrored(width: width) }
        var outK = k
        if mirrored {
            for i in 0..<nKpts { outK[i * 3] = Float(width - 1) - outK[i * 3] }
        }
        return TrackState(
            t: t, valid: model != nil, model: model, nFrets: nFrets, kpts: outK, anchorCount: anchors.count,
            endEstimate: estimate, held: fit == nil && model != nil, rmsePx: fit?.rmsePx ?? .nan
        )
    }
}
