import XCTest
@testable import MusicCore

final class YouTubeSearchTests: XCTestCase {
    private let validEntry: [String: Any] = [
        "id": "dQw4w9WgXcQ",
        "title": "  Artist — Song  ",
        "channel": "Artist channel",
        "duration": 213.5,
        // The canonical download URL must come from the validated ID, not this field.
        "url": "https://example.com/untrusted"
    ]

    func testQueryAndSearchArgumentsKeepShellLikeTextAsOneLiteralTarget() throws {
        let query = #"--exec touch /tmp/a; $(command) `other` 'Song'"#
        XCTAssertEqual(try YouTubeSearch.validatedQuery("  \(query)  "), query)
        XCTAssertEqual(try YouTubeSearch.searchArguments(query: query, limit: 1), [
            "--ignore-config", "--flat-playlist", "--dump-single-json",
            "--no-warnings", "--no-playlist", "--", "ytsearch1:\(query)"
        ])
        XCTAssertEqual(try YouTubeSearch.searchArguments(query: "Björk — Jóga", limit: 5).last, "ytsearch5:Björk — Jóga")
    }

    func testQueriesAndResultCountsAreBounded() throws {
        XCTAssertEqual(try YouTubeSearch.validatedQuery(String(repeating: "a", count: 500)).count, 500)
        for query in ["", "   ", String(repeating: "a", count: 501), "song\0name", "song\nname", "song\tname"] {
            XCTAssertThrowsError(try YouTubeSearch.validatedQuery(query), "Accepted invalid query: \(query.debugDescription)")
        }
        for limit in [-1, 0, 6, Int.max] {
            XCTAssertThrowsError(try YouTubeSearch.searchArguments(query: "Song", limit: limit))
        }
    }

    func testSearchMetadataUsesCanonicalURLAndLimitsMatches() throws {
        var second = validEntry
        second["id"] = "abcdefghijk"
        let results = try YouTubeSearch.searchResults(from: output([validEntry, second]), limit: 1)
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].title, "Artist — Song")
        XCTAssertEqual(results[0].url.absoluteString, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        XCTAssertEqual(results[0].channel, "Artist channel")
        XCTAssertEqual(results[0].duration, 213.5)
        XCTAssertEqual(try YouTubeSearch.searchResults(from: output([validEntry, second]), limit: 2).count, 2)
    }

    func testMissingOptionalMetadataAndUploaderFallback() throws {
        var entry: [String: Any] = ["id": "abcdefghijk", "title": "Song"]
        let withoutMetadata = try XCTUnwrap(YouTubeSearch.searchResults(from: output([entry]), limit: 1).first)
        XCTAssertNil(withoutMetadata.channel)
        XCTAssertNil(withoutMetadata.duration)
        entry["channel"] = NSNull()
        entry["duration"] = NSNull()
        entry["uploader"] = "Uploader"
        let withUploader = try XCTUnwrap(YouTubeSearch.searchResults(from: output([entry]), limit: 1).first)
        XCTAssertEqual(withUploader.channel, "Uploader")
        XCTAssertNil(withUploader.duration)
    }

    func testEmptyAndMalformedResultsFailClearly() throws {
        XCTAssertThrowsError(try YouTubeSearch.searchResults(from: output([]), limit: 1)) { error in
            XCTAssertEqual(error.localizedDescription, MusicUtilityError.noYouTubeSearchResults.localizedDescription)
        }
        for result in ["not json", "{}", #"{"entries":null}"#, #"{"entries":[null]}"#, #"{"entries":[{}]}"#, String(repeating: " ", count: 1024 * 1024 + 1)] {
            XCTAssertThrowsError(try YouTubeSearch.searchResults(from: result, limit: 1)) { error in
                XCTAssertEqual(error.localizedDescription, MusicUtilityError.invalidYouTubeSearchResult.localizedDescription)
            }
        }
    }

    func testUnsafeVideoIDsAndInvalidMetadataAreRejected() throws {
        for id in ["", "short", "dQw4w9WgXcQ\n", "../abcdefgh", "--exec test", "https://youtu.be/dQw4w9WgXcQ", "ébcdefghijk"] {
            var entry = validEntry
            entry["id"] = id
            XCTAssertThrowsError(try YouTubeSearch.searchResults(from: output([entry]), limit: 1), "Accepted invalid ID: \(id.debugDescription)")
        }
        let updates: [[String: Any]] = [
            ["title": "  "], ["title": "song\0name"], ["title": String(repeating: "a", count: 513)],
            ["channel": "channel\nname"], ["duration": -1], ["duration": true], ["duration": "123"]
        ]
        for update in updates {
            let entry = validEntry.merging(update) { _, replacement in replacement }
            XCTAssertThrowsError(try YouTubeSearch.searchResults(from: output([entry]), limit: 1))
        }
    }

    private func output(_ entries: [[String: Any]]) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: ["entries": entries]), as: UTF8.self)
    }
}
