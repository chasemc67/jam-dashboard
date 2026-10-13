import Foundation
import XCTest
@testable import FretCore

final class RefitTests: XCTestCase {
    struct Fixture: Decodable {
        let item: String
        let k: [Float]
        let H: [Double]
        let expected: [Float]
    }

    func testSavedPythonFixtures() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "refit_reference", withExtension: "json",
                                                 subdirectory: "Fixtures"))
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
        XCTAssertEqual(fixtures.count, 50)
        for fixture in fixtures {
            XCTAssertEqual(reassignFittedWires(fixture.k, H: Mat3(fixture.H)), fixture.expected, fixture.item)
            XCTAssertEqual(refitFretNet(fixture.k), fixture.expected, "full fit: \(fixture.item)")
        }
    }

    func testMeasuredSpeedModelPredictions() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "speedup_reference", withExtension: "json",
                                                 subdirectory: "Fixtures"))
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
        XCTAssertEqual(fixtures.count, 14)
        for fixture in fixtures {
            // Includes held-out and 09-06 predictions from both exact measured W8A8 packages.
            let decoded = decode(raw: [0, 0, 0, 0, 1] + fixture.k, anchorCount: 1)
            XCTAssertEqual(refitFretNet(decoded.kpts), fixture.expected, fixture.item)
        }
    }

    func testInvalidPointsAndFitFallback() {
        var k = [Float](repeating: 0, count: 150)
        k[0] = .nan; k[2] = 0.9
        XCTAssertEqual(reassignFittedWires(k, H: .identity), [Float](repeating: 0, count: 150))
        k[0] = 0; k[1] = 0.5
        XCTAssertEqual(refitFretNet(k), k) // too few fit anchors
        k[0] = 1.1
        XCTAssertEqual(reassignFittedWires(k, H: .identity), [Float](repeating: 0, count: 150))
    }

    func testCollisionAndStrictThreshold() {
        var k = [Float](repeating: 0, count: 150)
        // Both bass observations land exactly on wire zero; highest confidence wins.
        k[1] = 0.1; k[2] = 0.7
        k[7] = 0.2; k[8] = 0.9
        let out = reassignFittedWires(k, H: .identity)
        XCTAssertEqual(Array(out.prefix(3)), [0, 0.2, 0.9])
        XCTAssertEqual(out[8], 0)
        XCTAssertEqual(reassignFittedWires(k, H: .identity, tolerance: 0), [Float](repeating: 0, count: 150))
        // Equal confidence keeps the first observation.
        k[8] = 0.7
        XCTAssertEqual(reassignFittedWires(k, H: .identity)[1], 0.1)
    }
}
