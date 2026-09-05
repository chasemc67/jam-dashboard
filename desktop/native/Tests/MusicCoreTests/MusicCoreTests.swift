import XCTest
@testable import MusicCore

final class MusicCoreTests: XCTestCase {
    func testProcessOutputLargerThanPipeCapacity() throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", "/usr/bin/head -c 131072 /dev/zero; /usr/bin/head -c 131072 /dev/zero >&2"]
        let result = try ProcessRunner.run(process)
        XCTAssertEqual(process.terminationStatus, 0)
        XCTAssertEqual(result.output.utf8.count, 131072)
        XCTAssertEqual(result.error.utf8.count, 131072)
    }

    func testYouTubeURLValidation() throws {
        XCTAssertNoThrow(try MediaDownloader.validatedYouTubeURL("https://youtu.be/abc123"))
        XCTAssertNoThrow(try MediaDownloader.validatedYouTubeURL("https://music.youtube.com/watch?v=abc123"))
        XCTAssertThrowsError(try MediaDownloader.validatedYouTubeURL("https://example.com/video"))
    }

    func testDownloadedPathParsing() {
        let output = "some status\n/Users/example/Desktop/My Song.mp3\n"
        XCTAssertEqual(MediaDownloader.downloadedPath(from: output), "/Users/example/Desktop/My Song.mp3")
    }

    func testCmajorProfileDetection() {
        let cMajorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        let result = AudioAnalyzer.detectKey(fromChroma: cMajorProfile)
        XCTAssertEqual(result.name, "C major")
        XCTAssertGreaterThan(result.confidence, 0.4)
    }

    func testAminorProfileDetection() {
        let aMinorProfile = [5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17, 6.33, 2.68, 3.52]
        let result = AudioAnalyzer.detectKey(fromChroma: aMinorProfile)
        XCTAssertEqual(result.name, "A minor")
    }

    func testTempoDetectionAt120BPM() {
        let result = AudioAnalyzer.estimateTempo(
            from: syntheticClickTrack(bpm: 120),
            sampleRate: 11_025
        )
        XCTAssertEqual(result.bpm, 120, accuracy: 1.5)
    }

    func testTempoDetectionAt90BPM() {
        let result = AudioAnalyzer.estimateTempo(
            from: syntheticClickTrack(bpm: 90),
            sampleRate: 11_025
        )
        XCTAssertEqual(result.bpm, 90, accuracy: 1.5)
    }

    func testStructuredKeySelectionForEnharmonicMinor() {
        let result = MusicAnalysis(bpm: 90, musicalKey: "F♯ / G♭ minor", tempoConfidence: 0.8, keyConfidence: 0.7)
        XCTAssertEqual(result.keyScale, "F# minor")
        XCTAssertEqual(result.relativeMajorKeyScale, "A major")
    }

    func testStructuredKeySelectionForMajorAndUnknown() {
        XCTAssertEqual(MusicAnalysis(bpm: 120, musicalKey: "C major", tempoConfidence: 1, keyConfidence: 1).keyScale, "C major")
        XCTAssertNil(MusicAnalysis(bpm: 120, musicalKey: "Unknown", tempoConfidence: 0, keyConfidence: 0).keyScale)
    }

    func testRelativeMajorForMinorKey() {
        let analysis = MusicAnalysis(
            bpm: 70,
            musicalKey: "A minor",
            tempoConfidence: 1,
            keyConfidence: 1
        )
        XCTAssertEqual(analysis.relativeMajorKey, "C major")
    }

    func testRelativeMajorIsAbsentForMajorKey() {
        let analysis = MusicAnalysis(
            bpm: 120,
            musicalKey: "D major",
            tempoConfidence: 1,
            keyConfidence: 1
        )
        XCTAssertNil(analysis.relativeMajorKey)
    }

    private func syntheticClickTrack(bpm: Double) -> [Double] {
        let sampleRate = 11_025.0
        let duration = 45.0
        let interval = Int(sampleRate * 60 / bpm)
        var samples = [Double](repeating: 0, count: Int(sampleRate * duration))
        var beat = 0
        while beat * interval < samples.count {
            let start = beat * interval
            let accent = beat % 4 == 0 ? 1.0 : 0.7
            for offset in 0..<min(180, samples.count - start) {
                let envelope = exp(-Double(offset) / 35)
                samples[start + offset] += accent * envelope * sin(2 * .pi * 900 * Double(offset) / sampleRate)
            }
            beat += 1
        }
        return samples
    }
}
