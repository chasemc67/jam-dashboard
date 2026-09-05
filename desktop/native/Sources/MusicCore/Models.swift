import Foundation

public struct MusicAnalysis: Sendable, Equatable {
    public let bpm: Double
    public let musicalKey: String
    public let tempoConfidence: Double
    public let keyConfidence: Double

    public init(
        bpm: Double,
        musicalKey: String,
        tempoConfidence: Double,
        keyConfidence: Double
    ) {
        self.bpm = bpm
        self.musicalKey = musicalKey
        self.tempoConfidence = tempoConfidence
        self.keyConfidence = keyConfidence
    }

    /// The relative major shares the same key signature as a detected minor key.
    public var relativeMajorKey: String? {
        guard musicalKey.hasSuffix(" minor") else { return nil }
        let tonic = String(musicalKey.dropLast(" minor".count))
        let pitchClassNames = [
            "C", "C♯ / D♭", "D", "D♯ / E♭", "E", "F",
            "F♯ / G♭", "G", "G♯ / A♭", "A", "A♯ / B♭", "B"
        ]
        guard let minorPitchClass = pitchClassNames.firstIndex(of: tonic) else { return nil }
        return "\(pitchClassNames[(minorPitchClass + 3) % 12]) major"
    }
}

public enum MusicUtilityError: LocalizedError {
    case invalidYouTubeURL
    case missingTool(String)
    case processFailed(tool: String, message: String)
    case downloadDidNotProduceFile
    case unsupportedAudioFormat
    case audioTooShort

    public var errorDescription: String? {
        switch self {
        case .invalidYouTubeURL:
            return "Enter a valid youtube.com or youtu.be URL."
        case .missingTool(let tool):
            return "Could not find \(tool). Install it with Homebrew, then reopen the app."
        case .processFailed(let tool, let message):
            return "\(tool) failed: \(message)"
        case .downloadDidNotProduceFile:
            return "The download finished, but the MP3 path could not be found."
        case .unsupportedAudioFormat:
            return "The downloaded audio could not be decoded."
        case .audioTooShort:
            return "The audio is too short to estimate its tempo and key."
        }
    }
}
