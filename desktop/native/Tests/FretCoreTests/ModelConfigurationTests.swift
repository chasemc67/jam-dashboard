import XCTest
@testable import FretCore

final class ModelConfigurationTests: XCTestCase {
    func testBundledModelContracts() throws {
        for (name, size, refit) in [
            ("FretTrackerV1", 640, false), ("FretTrackerV3", 640, false),
            ("FretTrackerV4Q832", 832, true), ("FretTrackerR832W8A8", 832, true),
            ("FretTrackerExtended512W8A8", 512, true),
        ] {
            let config = try XCTUnwrap(FretModelConfiguration(packageName: name))
            XCTAssertEqual(config.inputSize, size)
            XCTAssertEqual(config.usesRefit, refit)
        }
        XCTAssertNil(FretModelConfiguration(packageName: "Unknown832"))
    }
}
