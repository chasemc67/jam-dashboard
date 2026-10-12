import Foundation
import XCTest
@testable import FretCore

private struct Reference: Decodable {
    struct Fit: Decodable {
        let H_true: [Double]
        let anchors: [[Double]]
        let H_py: [Double]
        let rmse_py: Double
        let n_inliers: Int
    }
    struct Ridge: Decodable {
        let H: [Double]
        let width: Int
        let height: Int
        let scores: [String: Double]
        let last: Int?
    }
    struct EuroFrame: Decodable {
        let H: [Double]
        let dt: Double?
    }
    struct Euro: Decodable {
        let fps: Double
        let nFrets: Int
        let width: Int
        let height: Int
        let frames: [EuroFrame]
        let out: [[Double]]
    }
    struct VoteStep: Decodable {
        let estimate: Int?
        let conf: [Double]
        let value: Int
        let shown: Int
        let settled: Bool
    }
    struct DLT: Decodable {
        let src: [[Double]]
        let dst: [[Double]]
        let H_py: [Double]
    }
    let fit: Fit
    let ridge: Ridge
    let euro: Euro
    let vote: [VoteStep]
    let dlt: DLT
}

private func loadReference() throws -> Reference {
    let url = try XCTUnwrap(Bundle.module.url(forResource: "gro_reference", withExtension: "json", subdirectory: "Fixtures"))
    return try JSONDecoder().decode(Reference.self, from: Data(contentsOf: url))
}

/// Max distance in px between two homographies over the board (wires 0..22, both edges).
private func boardDiff(_ a: Mat3, _ b: Mat3, frets: Int = 22) -> Double {
    let ma = FretboardModel(H: a), mb = FretboardModel(H: b)
    var d = 0.0
    for n in 0...frets {
        for y in [0.0, 1.0] {
            let p = ma.projectFY(Double(n), y), q = mb.projectFY(Double(n), y)
            d = max(d, hypot(p.x - q.x, p.y - q.y))
        }
    }
    return d
}

/// Same synthetic board image as scripts/fret_fixtures.py (dark board, bright wires 0...last).
private func ridgeImage(_ H: Mat3, width: Int, height: Int, last: Int = 22) -> [UInt8] {
    // inverse of H via adjugate
    let m = H.m
    let inv = Mat3([
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
    ])
    var img = [UInt8](repeating: 30, count: width * height)
    for y in 0..<height {
        for x in 0..<width {
            let (u, Y) = inv.apply(Double(x), Double(y))
            guard u < 1 else { continue }
            let yc = Y / (1 + 0.3 * u) + 0.5
            guard yc > -0.2 && yc < 1.2 else { continue }
            let fret = -12 * log2(1 - u)
            let near = abs(fret - fret.rounded(.toNearestOrEven)) < 0.08 && fret.rounded(.toNearestOrEven) <= Double(last)
            img[y * width + x] = near ? 200 : 60
        }
    }
    return img
}

final class FretCoreTests: XCTestCase {
    func testLetterbox() {
        let a = Letterbox(width: 1920, height: 1080)
        XCTAssertEqual([a.newW, a.newH, a.left, a.top], [640, 360, 0, 140])
        let b = Letterbox(width: 1280, height: 720)
        XCTAssertEqual([b.newW, b.newH, b.left, b.top], [640, 360, 0, 140])
        let c = Letterbox(width: 720, height: 1280)
        XCTAssertEqual([c.newW, c.newH, c.left, c.top], [360, 640, 140, 0])
        let d = Letterbox(width: 640, height: 480)
        XCTAssertEqual([d.newW, d.newH, d.left, d.top], [640, 480, 0, 80])
        // round trip + clip
        let (x, y) = a.toFrame(x: 320, y: 320)
        XCTAssertEqual(Double(x), 960, accuracy: 1e-3)
        XCTAssertEqual(Double(y), 540, accuracy: 1e-3)
        let (lx, ly) = a.toLetterbox(x: 960, y: 540)
        XCTAssertEqual(lx, 320, accuracy: 1e-9)
        XCTAssertEqual(ly, 320, accuracy: 1e-9)
        let (cx, cy) = a.toFrame(x: -5, y: 600)
        XCTAssertEqual(cx, 0)
        XCTAssertEqual(cy, 1080)
    }

    func testDecodeArgmaxAndThreshold() {
        let n = 8400
        var raw = [Float](repeating: 0, count: 155 * n)
        raw[4 * n + 17] = 0.6
        raw[4 * n + 4000] = 0.9
        raw[4 * n + 5000] = 0.9  // tie: first wins
        for c in 0..<150 { raw[(5 + c) * n + 4000] = Float(c) }
        let det = decode(raw: raw, anchorCount: n)
        XCTAssertEqual(det.score, 0.9, accuracy: 1e-6)
        XCTAssertEqual(det.kpts[0], 0)
        XCTAssertEqual(det.kpts[149], 149)
        raw[4 * n + 4000] = 0.2
        raw[4 * n + 5000] = 0.2
        raw[4 * n + 17] = 0.24
        let low = decode(raw: raw, anchorCount: n)
        XCTAssertEqual(low.score, 0.24, accuracy: 1e-6)
        XCTAssertTrue(low.kpts.allSatisfy { $0.isNaN })
        XCTAssertTrue(anchorsFrom(low.kpts).isEmpty)
    }

    func testDLTRecoversKnownH() throws {
        let ref = try loadReference()
        let src = ref.dlt.src.map { Point($0[0], $0[1]) }
        let dst = ref.dlt.dst.map { Point($0[0], $0[1]) }
        let H = try XCTUnwrap(dlt(src, dst))
        for (a, b) in zip(H.m, ref.fit.H_true) { XCTAssertEqual(a, b, accuracy: 1e-6 * max(1, abs(b))) }
        for (a, b) in zip(H.m, ref.dlt.H_py) { XCTAssertEqual(a, b, accuracy: 1e-6 * max(1, abs(b))) }
        // minimal 4-point sample (rows < 9)
        let H4 = try XCTUnwrap(dlt([src[0], src[1], src[6], src[7]], [dst[0], dst[1], dst[6], dst[7]]))
        XCTAssertLessThan(boardDiff(H4, Mat3(ref.fit.H_true), frets: 19), 1e-6)
    }

    func testFitRecoversKnownHWithOutliers() throws {
        let ref = try loadReference()
        let anchors = ref.fit.anchors.map {
            Anchor(fret: Int($0[0]), side: Int($0[1]), x: $0[2], y: $0[3], conf: $0[4])
        }
        let m = try fitFretboard(anchors)
        XCTAssertLessThan(boardDiff(m.H, Mat3(ref.fit.H_true), frets: 15), 1.5)
        XCTAssertLessThan(boardDiff(m.H, Mat3(ref.fit.H_py), frets: 15), 0.05)
        XCTAssertEqual(m.inlierCount, ref.fit.n_inliers)
        XCTAssertEqual(m.rmsePx, ref.fit.rmse_py, accuracy: 0.01)
        // too few / degenerate
        XCTAssertThrowsError(try fitFretboard(Array(anchors.prefix(3))))
        XCTAssertThrowsError(try fitFretboard(anchors.filter { $0.side == 0 }))
        XCTAssertNil(safeFit(anchors.filter { $0.fret == 3 }))
    }

    func testRidgeScoresAndLastFret() throws {
        let ref = try loadReference()
        let H = Mat3(ref.ridge.H)
        let img = GrayImage(width: ref.ridge.width, height: ref.ridge.height,
                            pixels: ridgeImage(H, width: ref.ridge.width, height: ref.ridge.height))
        let scores = ridgeScores(img, FretboardModel(H: H))
        XCTAssertEqual(Set(scores.keys.map(String.init)), Set(ref.ridge.scores.keys))
        for (k, v) in ref.ridge.scores { XCTAssertEqual(scores[Int(k)!]!, v, accuracy: 0.05, "wire \(k)") }
        XCTAssertEqual(frameLastFret(scores), ref.ridge.last)
        XCTAssertEqual(frameLastFret(scores), 22)
    }

    func testFrameLastFretCases() {
        let full: [Int: Double] = [19: 1, 20: 1, 21: 1, 22: 1, 23: 0.1, 24: 0.05]
        XCTAssertEqual(frameLastFret(full), 22)
        XCTAssertEqual(frameLastFret([19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1]), 24)
        XCTAssertNil(frameLastFret([19: 1, 20: 1, 21: 1]))  // 22 out of view
        XCTAssertNil(frameLastFret([19: 1, 20: 0.1, 21: 0.1]))  // < 20
        XCTAssertNil(frameLastFret([:]))
        // weak ridge rescued by confident keypoints
        var conf = [Double](repeating: 0.9, count: 25)
        let weak: [Int: Double] = [19: 1, 20: 1, 21: 0.2, 22: 0.0, 23: 0, 24: 0]
        XCTAssertEqual(frameLastFret(weak, conf: conf), 21)
        conf[21] = .nan
        XCTAssertEqual(frameLastFret(weak, conf: conf), 20)
        XCTAssertEqual(frameLastFret([19: 1, 20: 1, 21: 0.1, 23: 0]), 20)  // stops at 21, which is in view
    }

    func testFretCountVoteMatchesPython() throws {
        let ref = try loadReference()
        var v = FretCountVote()
        for (i, step) in ref.vote.enumerated() {
            v.update(step.estimate)
            v.observeConf(step.conf)
            XCTAssertEqual(v.value, step.value, "step \(i)")
            XCTAssertEqual(v.shown, step.shown, "step \(i)")
            XCTAssertEqual(v.settled, step.settled, "step \(i)")
        }
    }

    func testFretCountVoteHysteresisAndCap() {
        var v = FretCountVote()
        XCTAssertEqual(v.shown, 24)
        var conf = [Double](repeating: 0, count: 25)
        for i in 0...20 { conf[i] = 0.9 }
        v.observeConf(conf)
        XCTAssertEqual(v.shown, 20)  // cap from the only frame seen
        conf[11...] = [Double](repeating: 0, count: 14)[...]
        v.observeConf(conf)  // highest confident fret < 12: ignored
        XCTAssertEqual(v.cap, 20)
        for _ in 0..<14 { v.update(22) }
        XCTAssertEqual(v.value, 24)  // < min_votes
        v.update(22)
        XCTAssertEqual(v.value, 22)  // mode leads by >= margin
        XCTAssertTrue(v.settled)
        XCTAssertEqual(v.shown, 22)  // settled: cap no longer applies
        for _ in 0..<9 { v.update(21) }
        XCTAssertEqual(v.value, 22)
        for _ in 0..<20 { v.update(21) }  // 21: 29 vs 22: 15 -> switches
        XCTAssertEqual(v.value, 21)
        var o = FretCountVote(override: 21)
        o.update(24)
        XCTAssertEqual(o.shown, 21)
        XCTAssertTrue(o.settled)
    }

    func testOneEuroMatchesPython() throws {
        let ref = try loadReference()
        var f = OneEuroModel(fps: ref.euro.fps)
        for (i, fr) in ref.euro.frames.enumerated() {
            let m = FretboardModel(H: Mat3(fr.H), nFrets: ref.euro.nFrets)
            let out = f.update(m, width: ref.euro.width, height: ref.euro.height, dt: fr.dt)
            XCTAssertLessThan(boardDiff(out.H, Mat3(ref.euro.out[i])), 1e-5, "frame \(i)")
        }
    }

    func testOneEuroStaticInputStaysPut() {
        let H = Mat3([1100, 30, 80, 40, 160, 300, 0.15, 0.05, 1])
        var f = OneEuroModel(fps: 30)
        for _ in 0..<50 {
            let out = f.update(FretboardModel(H: H, nFrets: 22), width: 1280, height: 720, dt: 1.0 / 30)
            XCTAssertLessThan(boardDiff(out.H, H), 1e-6)
        }
    }

    func testMirrorComposition() {
        let H = Mat3([1100, 30, 80, 40, 160, 300, 0.15, 0.05, 1])
        let m = FretboardModel(H: H)
        let mm = m.mirrored(width: 1280)
        for n in [0.0, 5, 12, 22] {
            for y in [0.0, 1.0] {
                let p = m.projectFY(n, y), q = mm.projectFY(n, y)
                XCTAssertEqual(q.x, 1279 - p.x, accuracy: 1e-9)
                XCTAssertEqual(q.y, p.y, accuracy: 1e-9)
            }
        }
        XCTAssertEqual(mirrorMatrix(width: 1280) * mirrorMatrix(width: 1280), .identity)
    }

    func testTrackerSyntheticSequenceMirroredAndHeld() {
        // keypoints from a known canonical H (canonical frame px); fixed frets so no image is needed
        let W = 1280, Hh = 720
        let H = Mat3([1100, 30, 80, 40, 160, 300, 0.15, 0.05, 1])
        let model = FretboardModel(H: H)
        var k = [Float](repeating: 0, count: 150)
        for i in 0..<50 {
            let p = model.projectFY(Double(i / 2), Double(i % 2))
            k[i * 3] = Float(p.x)
            k[i * 3 + 1] = Float(p.y)
            k[i * 3 + 2] = i / 2 <= 15 ? 0.9 : 0.1
        }
        let tr = FretboardTracker(frets: 22)
        var s = tr.update(kpts: k, width: W, height: Hh, mirrored: true, t: 0) { nil }
        XCTAssertTrue(s.valid)
        XCTAssertFalse(s.held)
        XCTAssertEqual(s.nFrets, 22)
        XCTAssertEqual(s.wires().count, 23)
        let nut = s.wires()[0].0, ref = model.projectFY(0, 0)
        XCTAssertEqual(nut.x, Double(W - 1) - ref.x, accuracy: 0.05)
        XCTAssertEqual(nut.y, ref.y, accuracy: 0.05)
        XCTAssertEqual(Double(s.kpts[0]), Double(W - 1) - Double(k[0]), accuracy: 1e-3)
        // no detection: held for `hold` frames, then invalid
        let none = [Float](repeating: .nan, count: 150)
        for i in 1...10 {
            s = tr.update(kpts: none, width: W, height: Hh, mirrored: true, t: Double(i) / 30) { nil }
            XCTAssertTrue(s.valid)
            XCTAssertTrue(s.held)
        }
        s = tr.update(kpts: none, width: W, height: Hh, mirrored: true, t: 11.0 / 30) { nil }
        XCTAssertFalse(s.valid)
        XCTAssertFalse(s.held)
        tr.reset()
        XCTAssertEqual(tr.frameIndex, 0)
    }
}
