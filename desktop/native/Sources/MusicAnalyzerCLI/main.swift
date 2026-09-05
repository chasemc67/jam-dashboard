import Foundation
import MusicCore

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: MusicAnalyzerCLI /path/to/audio.mp3\n".utf8))
    exit(2)
}

do {
    let fileURL = URL(fileURLWithPath: CommandLine.arguments[1])
    let result = try AudioAnalyzer().analyze(fileURL: fileURL)
    print(String(format: "BPM: %.1f", result.bpm))
    print("Key: \(result.musicalKey)")
    print(String(format: "Tempo confidence: %.0f%%", result.tempoConfidence * 100))
    print(String(format: "Key confidence: %.0f%%", result.keyConfidence * 100))
} catch {
    FileHandle.standardError.write(Data("Analysis failed: \(error.localizedDescription)\n".utf8))
    exit(1)
}
