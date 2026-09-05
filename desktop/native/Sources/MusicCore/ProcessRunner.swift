import Foundation

/// File-backed output prevents a noisy downloader/decoder from filling a pipe
/// while the parent waits for exit. Each invocation owns and cleans its logs.
enum ProcessRunner {
    static func run(_ process: Process) throws -> (output: String, error: String) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("jam-process-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let outputURL = directory.appendingPathComponent("stdout")
        let errorURL = directory.appendingPathComponent("stderr")
        FileManager.default.createFile(atPath: outputURL.path, contents: nil)
        FileManager.default.createFile(atPath: errorURL.path, contents: nil)
        let output = try FileHandle(forWritingTo: outputURL)
        let error = try FileHandle(forWritingTo: errorURL)
        defer { try? output.close(); try? error.close() }
        process.standardOutput = output
        process.standardError = error
        process.standardInput = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
        return (
            String(decoding: try Data(contentsOf: outputURL), as: UTF8.self),
            String(decoding: try Data(contentsOf: errorURL), as: UTF8.self)
        )
    }
}
