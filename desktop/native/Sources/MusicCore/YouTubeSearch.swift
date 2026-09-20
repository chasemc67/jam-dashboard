import Foundation

/// A search match, kept separate from downloading so callers can offer choices later.
public struct YouTubeSearchResult: Sendable, Equatable {
    public let title: String
    public let url: URL
    public let channel: String?
    public let duration: Double?
}

public enum YouTubeSearch {
    public static func validatedQuery(_ rawValue: String) throws -> String {
        guard !rawValue.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains) else {
            throw MusicUtilityError.invalidYouTubeSearch
        }
        let query = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, query.count <= 500 else {
            throw MusicUtilityError.invalidYouTubeSearch
        }
        return query
    }

    public static func search(_ rawQuery: String, limit: Int = 1) throws -> [YouTubeSearchResult] {
        let arguments = try searchArguments(query: rawQuery, limit: limit)
        guard let ytDLP = ToolLocator.find("yt-dlp") else {
            throw MusicUtilityError.missingTool("yt-dlp")
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: ytDLP)
        process.arguments = arguments
        process.environment = ProcessInfo.processInfo.environment.merging(["PATH": ToolLocator.searchPath]) { _, new in new }

        let output: (output: String, error: String)
        do {
            output = try ProcessRunner.run(process)
        } catch {
            throw MusicUtilityError.processFailed(tool: "YouTube search", message: error.localizedDescription)
        }
        guard process.terminationStatus == 0 else {
            let message = output.error.split(separator: "\n").last.map(String.init) ?? "Search could not finish."
            throw MusicUtilityError.processFailed(tool: "YouTube search", message: message)
        }
        return try searchResults(from: output.output, limit: limit)
    }

    static func searchArguments(query rawQuery: String, limit: Int) throws -> [String] {
        let query = try validatedQuery(rawQuery)
        guard (1...5).contains(limit) else {
            throw MusicUtilityError.invalidYouTubeSearch
        }
        return [
            "--ignore-config",
            "--flat-playlist",
            "--dump-single-json",
            "--no-warnings",
            "--no-playlist",
            "--",
            "ytsearch\(limit):\(query)"
        ]
    }

    static func searchResults(from output: String, limit: Int) throws -> [YouTubeSearchResult] {
        guard (1...5).contains(limit), output.utf8.count <= 1024 * 1024,
              let response = try? JSONDecoder().decode(SearchResponse.self, from: Data(output.utf8)) else {
            throw MusicUtilityError.invalidYouTubeSearchResult
        }
        guard !response.entries.isEmpty else {
            throw MusicUtilityError.noYouTubeSearchResults
        }
        return try response.entries.prefix(limit).map { entry in
            guard entry.id.utf8.count == 11,
                  entry.id.range(of: #"^[A-Za-z0-9_-]{11}$"#, options: .regularExpression) != nil,
                  let title = validatedLabel(entry.title),
                  entry.duration.map({ $0.isFinite && $0 >= 0 }) ?? true else {
                throw MusicUtilityError.invalidYouTubeSearchResult
            }
            let channel: String?
            if let rawChannel = entry.channel ?? entry.uploader {
                guard let value = validatedLabel(rawChannel) else {
                    throw MusicUtilityError.invalidYouTubeSearchResult
                }
                channel = value
            } else {
                channel = nil
            }
            // Never trust a URL returned by a search provider. Only an exact video ID
            // can become a download target, on the same host as direct YouTube inputs.
            let url = URL(string: "https://www.youtube.com/watch?v=\(entry.id)")!
            return YouTubeSearchResult(title: title, url: url, channel: channel, duration: entry.duration)
        }
    }

    private static func validatedLabel(_ rawValue: String) -> String? {
        let label = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !label.isEmpty, label.count <= 512,
              !rawValue.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains) else { return nil }
        return label
    }

    private struct SearchResponse: Decodable {
        let entries: [SearchEntry]
    }

    private struct SearchEntry: Decodable {
        let id: String
        let title: String
        let channel: String?
        let uploader: String?
        let duration: Double?
    }
}
