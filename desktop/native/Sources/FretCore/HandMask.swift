import Foundation
import Vision
import CoreVideo

/// Alpha in top-left-origin, letterboxed input coordinates, before undoing model mirroring.
public struct HandMask {
    public let width: Int
    public let height: Int
    public let alpha: [UInt8]
    public let boxes: [[Double]]
}

public final class HandMaskTracker {
    private let pose = VNDetectHumanHandPoseRequest()
    private let person = VNGeneratePersonSegmentationRequest()
    public init() {
        pose.maximumHandCount = 2
        person.outputPixelFormat = kCVPixelFormatType_OneComponent8
    }

    /// A modest expansion covers fingertips outside confident joint locations.
    public static func box(points: [CGPoint]) -> CGRect? {
        guard points.count >= 5 else { return nil }
        let xs = points.map(\.x), ys = points.map(\.y)
        let rect = CGRect(x: xs.min()!, y: ys.min()!, width: xs.max()! - xs.min()!, height: ys.max()! - ys.min()!)
        let pad = max(0.015, max(rect.width, rect.height) * 0.18)
        return rect.insetBy(dx: -pad, dy: -pad).intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
    }

    public static func isSkin(r: Int, g: Int, b: Int) -> Bool {
        let cb = 128 - 0.168736 * Double(r) - 0.331264 * Double(g) + 0.5 * Double(b)
        let cr = 128 + 0.5 * Double(r) - 0.418688 * Double(g) - 0.081312 * Double(b)
        return r > 45 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
    }

    public func mask(_ input: CVPixelBuffer, option: Int) throws -> HandMask {
        let handler = VNImageRequestHandler(cvPixelBuffer: input, orientation: .up)
        try handler.perform([pose])
        let boxes: [CGRect] = try (pose.results ?? []).compactMap { hand in
            let points = try hand.recognizedPoints(.all).values.filter { $0.confidence >= 0.2 }
                .map { CGPoint(x: $0.location.x, y: 1 - $0.location.y) }
            return Self.box(points: points)
        }
        let size = 208
        var alpha = [UInt8](repeating: 0, count: size * size)
        guard !boxes.isEmpty else { return HandMask(width: size, height: size, alpha: alpha, boxes: []) }
        let source: CVPixelBuffer
        if option == 3 { source = input }
        else {
            person.qualityLevel = option == 1 ? .fast : .balanced
            try handler.perform([person])
            guard let buffer = person.results?.first?.pixelBuffer else {
                return HandMask(width: size, height: size, alpha: alpha, boxes: [])
            }
            source = buffer
        }
        CVPixelBufferLockBaseAddress(source, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(source, .readOnly) }
        let bytes = CVPixelBufferGetBaseAddress(source)!.assumingMemoryBound(to: UInt8.self)
        let stride = CVPixelBufferGetBytesPerRow(source)
        let w = CVPixelBufferGetWidth(source), h = CVPixelBufferGetHeight(source)
        for y in 0..<size {
            for x in 0..<size {
                let p = CGPoint(x: (Double(x) + 0.5) / Double(size), y: (Double(y) + 0.5) / Double(size))
                guard boxes.contains(where: { $0.contains(p) }) else { continue }
                let sx = min(w - 1, Int(p.x * Double(w))), sy = min(h - 1, Int(p.y * Double(h)))
                if option == 3 {
                    let i = sy * stride + sx * 4
                    alpha[y * size + x] = Self.isSkin(r: Int(bytes[i+2]), g: Int(bytes[i+1]), b: Int(bytes[i])) ? 255 : 0
                } else { alpha[y * size + x] = bytes[sy * stride + sx] }
            }
        }
        return HandMask(width: size, height: size, alpha: alpha,
                        boxes: boxes.map { [Double($0.minX), Double($0.minY), Double($0.maxX), Double($0.maxY)] })
    }
}
