import Foundation
import MusicCore

func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

let arguments = Array(CommandLine.arguments.dropFirst())
let jsonMode = arguments.first == "--json"

do {
    let fileURL: URL
    if jsonMode && arguments.count == 4 && arguments[1] == "download" {
        emit(["event": "status", "status": "downloading"])
        fileURL = try MediaDownloader.downloadMP3(from: arguments[2], to: URL(fileURLWithPath: arguments[3]))
        emit(["event": "file", "path": fileURL.path])
    } else if jsonMode && arguments.count == 3 && arguments[1] == "analyze" {
        fileURL = URL(fileURLWithPath: arguments[2])
    } else if !jsonMode && arguments.count == 1 {
        fileURL = URL(fileURLWithPath: arguments[0])
    } else {
        throw NSError(domain: "MusicAnalyzerCLI", code: 2, userInfo: [NSLocalizedDescriptionKey:
            "Usage: MusicAnalyzerCLI [--json analyze] /path/to/audio, or --json download YOUTUBE_URL DESTINATION"])
    }
    if jsonMode { emit(["event": "status", "status": "analyzing"]) }
    let result = try AudioAnalyzer().analyze(fileURL: fileURL)
    if jsonMode {
        emit(["event": "result", "analysis": [
            "bpm": result.bpm,
            "musicalKey": result.musicalKey,
            "tempoConfidence": result.tempoConfidence,
            "keyConfidence": result.keyConfidence,
            "keyScale": result.keyScale as Any? ?? NSNull(),
            "relativeMajorKey": result.relativeMajorKey as Any? ?? NSNull(),
            "relativeMajorKeyScale": result.relativeMajorKeyScale as Any? ?? NSNull()
        ]])
    } else {
        print(String(format: "BPM: %.1f", result.bpm))
        print("Key: \(result.musicalKey)")
        print(String(format: "Tempo confidence: %.0f%%", result.tempoConfidence * 100))
        print(String(format: "Key confidence: %.0f%%", result.keyConfidence * 100))
    }
} catch {
    if jsonMode { emit(["event": "error", "message": error.localizedDescription]) }
    else { FileHandle.standardError.write(Data("Analysis failed: \(error.localizedDescription)\n".utf8)) }
    exit(1)
}
