import AppKit
import Foundation
import MusicCore

@MainActor
final class AppViewModel: ObservableObject {
    @Published var youtubeURL = ""
    @Published var destination: URL
    @Published var isWorking = false
    @Published var status = "Ready"
    @Published var analysis: MusicAnalysis?
    @Published var downloadedFile: URL?
    @Published var errorMessage: String?

    init() {
        destination = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop")
    }

    var dependenciesReady: Bool {
        ToolLocator.find("yt-dlp") != nil && ToolLocator.find("ffmpeg") != nil
    }

    var destinationDisplayName: String {
        FileManager.default.displayName(atPath: destination.path)
    }

    func chooseDestination() {
        let panel = NSOpenPanel()
        panel.title = "Choose where MP3 files are saved"
        panel.prompt = "Choose"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = destination
        if panel.runModal() == .OK, let selectedURL = panel.url {
            destination = selectedURL
        }
    }

    func start() {
        guard !isWorking else { return }
        do {
            _ = try MediaDownloader.validatedYouTubeURL(youtubeURL)
        } catch {
            errorMessage = error.localizedDescription
            return
        }

        isWorking = true
        analysis = nil
        downloadedFile = nil
        errorMessage = nil
        status = "Downloading and converting to MP3…"
        let source = youtubeURL
        let destination = destination

        Task {
            do {
                let fileURL = try await Task.detached(priority: .userInitiated) {
                    try MediaDownloader.downloadMP3(from: source, to: destination)
                }.value
                downloadedFile = fileURL
                status = "Listening for tempo and harmony…"

                let result = try await Task.detached(priority: .userInitiated) {
                    try AudioAnalyzer().analyze(fileURL: fileURL)
                }.value
                analysis = result
                status = "Finished"
            } catch {
                errorMessage = error.localizedDescription
                status = "Couldn’t finish"
            }
            isWorking = false
        }
    }

    func revealDownloadedFile() {
        guard let downloadedFile else { return }
        NSWorkspace.shared.activateFileViewerSelecting([downloadedFile])
    }
}
