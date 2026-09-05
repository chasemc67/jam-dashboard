import Foundation

public enum MediaDownloader {
    public static func validatedYouTubeURL(_ rawValue: String) throws -> URL {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            let url = URL(string: trimmed),
            let scheme = url.scheme?.lowercased(),
            scheme == "https" || scheme == "http",
            let host = url.host?.lowercased(),
            host == "youtu.be" || host == "youtube.com" || host.hasSuffix(".youtube.com")
        else {
            throw MusicUtilityError.invalidYouTubeURL
        }
        return url
    }

    public static func downloadMP3(from rawURL: String, to destination: URL) throws -> URL {
        let sourceURL = try validatedYouTubeURL(rawURL)
        guard let ytDLP = ToolLocator.find("yt-dlp") else {
            throw MusicUtilityError.missingTool("yt-dlp")
        }
        guard let ffmpeg = ToolLocator.find("ffmpeg") else {
            throw MusicUtilityError.missingTool("ffmpeg")
        }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: destination.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw MusicUtilityError.processFailed(tool: "Downloader", message: "The destination folder no longer exists.")
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: ytDLP)
        process.arguments = [
            "--ignore-config",
            "--no-playlist",
            "--no-progress",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--embed-metadata",
            "--embed-thumbnail",
            "--convert-thumbnails", "jpg",
            "--ffmpeg-location", ffmpeg,
            "--print", "after_move:filepath",
            "--output", destination.appendingPathComponent("%(title)s.%(ext)s").path,
            sourceURL.absoluteString
        ]
        process.environment = ProcessInfo.processInfo.environment.merging(["PATH": ToolLocator.searchPath]) { _, new in new }

        let result: (output: String, error: String)
        do {
            result = try ProcessRunner.run(process)
        } catch {
            throw MusicUtilityError.processFailed(tool: "yt-dlp", message: error.localizedDescription)
        }

        let output = result.output
        let errorOutput = result.error

        guard process.terminationStatus == 0 else {
            let message = errorOutput
                .split(separator: "\n")
                .last
                .map(String.init) ?? "Unknown download error"
            throw MusicUtilityError.processFailed(tool: "yt-dlp", message: message)
        }

        guard let path = downloadedPath(from: output) else {
            throw MusicUtilityError.downloadDidNotProduceFile
        }
        let fileURL = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            throw MusicUtilityError.downloadDidNotProduceFile
        }
        return fileURL
    }

    static func downloadedPath(from output: String) -> String? {
        output
            .split(whereSeparator: \.isNewline)
            .map(String.init)
            .last(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
