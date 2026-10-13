import XCTest
import CoreVideo
@testable import FretCore

final class HandMaskTests: XCTestCase {
    func testBoxRequiresEnoughJointsAndClipsExpansion() {
        XCTAssertNil(HandMaskTracker.box(points: [CGPoint(x: 0.5, y: 0.5)]))
        let box = HandMaskTracker.box(points: [CGPoint(x: 0, y: 0), CGPoint(x: 0.1, y: 0.1), CGPoint(x: 0.2, y: 0.2), CGPoint(x: 0.3, y: 0.3), CGPoint(x: 0.4, y: 0.4)])!
        XCTAssertEqual(box.minX, 0)
        XCTAssertEqual(box.minY, 0)
        XCTAssertGreaterThan(box.maxX, 0.4)
    }
    func testSkinThreshold() {
        XCTAssertTrue(HandMaskTracker.isSkin(r: 190, g: 130, b: 100))
        XCTAssertFalse(HandMaskTracker.isSkin(r: 20, g: 20, b: 20))
        XCTAssertFalse(HandMaskTracker.isSkin(r: 30, g: 180, b: 220))
    }
    func testBlankFrameHasNoHandMask() throws {
        var buffer: CVPixelBuffer?
        XCTAssertEqual(CVPixelBufferCreate(kCFAllocatorDefault, 640, 640, kCVPixelFormatType_32BGRA, nil, &buffer), kCVReturnSuccess)
        let pb = try XCTUnwrap(buffer)
        CVPixelBufferLockBaseAddress(pb, [])
        memset(CVPixelBufferGetBaseAddress(pb), 0, CVPixelBufferGetBytesPerRow(pb) * 640)
        CVPixelBufferUnlockBaseAddress(pb, [])
        let mask = try HandMaskTracker().mask(pb, option: 1)
        XCTAssertEqual(mask.alpha.count, 208 * 208)
        XCTAssertTrue(mask.alpha.allSatisfy { $0 == 0 })
        XCTAssertTrue(mask.boxes.isEmpty)
    }
}
