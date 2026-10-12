import Foundation

// Port of gro.smooth.OneEuroModel: One-Euro filter on the image positions of fixed canonical control points
// (wires 0/6/12/18/last x outer edges) with one shared cutoff, then a DLT refit of H.

public let controlFrets: [Int] = [0, 6, 12, 18]

@inline(__always)
func oneEuroAlpha(_ cutoffHz: Double, _ dt: Double) -> Double {
    let tau = 1.0 / (2 * Double.pi * cutoffHz)
    return 1.0 / (1.0 + tau / dt)
}

public struct OneEuroModel {
    public let dt: Double
    public let minCutoff: Double, beta: Double, dCutoff: Double, speedFloor: Double
    public private(set) var x: [Point]? = nil
    public private(set) var dx: Double = 0
    private var key: (Int, Double)? = nil

    public init(fps: Double, minCutoff: Double = 0.4, beta: Double = 3.0, dCutoff: Double = 1.0, speedFloor: Double = 2.0) {
        dt = 1.0 / fps
        self.minCutoff = minCutoff
        self.beta = beta
        self.dCutoff = dCutoff
        self.speedFloor = speedFloor
    }

    func controls(_ model: FretboardModel) -> (canon: [Point], img: [Point], fw: [Double]) {
        let frets = (controlFrets + [model.nFrets]).map(Double.init)
        var canon: [Point] = [], img: [Point] = [], fw: [Double] = []
        for f in frets {
            for y in [0.0, 1.0] {
                canon.append(planePoint(fretU(f), y, tau: model.tau))
                img.append(model.project(fretU(f), y))
                fw.append(model.fretWidthPx(min(f, Double(model.nFrets - 1)), y))
            }
        }
        return (canon, img, fw)
    }

    public mutating func reset() {
        x = nil
        dx = 0
        key = nil
    }

    /// Filter one fit. `dt` (s since the previous update) defaults to 1/fps when nil or not > 0.
    /// `width`/`height`: canonical frame size (control points in view).
    public mutating func update(_ model: FretboardModel, width: Int, height: Int, dt dtIn: Double? = nil) -> FretboardModel {
        let dt = (dtIn.map { $0 > 0 } ?? false) ? dtIn! : self.dt
        let (canon, img, fw) = controls(model)
        let allFinite = img.allSatisfy { $0.x.isFinite && $0.y.isFinite }
        if x == nil || key == nil || key! != (model.nFrets, model.tau) || !allFinite {
            x = img
            dx = 0
            key = (model.nFrets, model.tau)
            return model
        }
        let prev = x!
        let w = Double(width), h = Double(height)
        let inview = img.map { $0.x >= 0 && $0.x < w && $0.y >= 0 && $0.y < h }
        let nIn = inview.filter { $0 }.count
        var speeds: [Double] = []
        for i in 0..<img.count where nIn < 2 || inview[i] {
            speeds.append(hypot(img[i].x - prev[i].x, img[i].y - prev[i].y) / max(fw[i], 1e-3))
        }
        let speed = median(speeds) / dt
        let aD = oneEuroAlpha(dCutoff, dt)
        dx = aD * speed + (1 - aD) * dx
        let cutoff = minCutoff + beta * max(0.0, dx - speedFloor)
        let a = oneEuroAlpha(cutoff, dt)
        let nx = (0..<img.count).map { Point(a * img[$0].x + (1 - a) * prev[$0].x, a * img[$0].y + (1 - a) * prev[$0].y) }
        x = nx
        var out = model
        guard let H = dlt(canon, nx) else { return model }
        out.H = H.normalized
        return out
    }
}
