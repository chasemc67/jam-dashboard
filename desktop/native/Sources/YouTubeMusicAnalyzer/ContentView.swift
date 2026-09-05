import MusicCore
import SwiftUI

struct ContentView: View {
    @StateObject private var model = AppViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            header
            inputCard
            actionArea
            resultArea
        }
        .padding(30)
        .frame(width: 650)
        .background(
            LinearGradient(
                colors: [Color(nsColor: .windowBackgroundColor), Color.accentColor.opacity(0.06)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "waveform.badge.magnifyingglass")
                .font(.system(size: 32, weight: .semibold))
                .foregroundStyle(.tint)
                .frame(width: 50, height: 50)
                .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 13))

            VStack(alignment: .leading, spacing: 3) {
                Text("YouTube Music Analyzer")
                    .font(.title2.bold())
                Text("Download an MP3 and estimate its tempo and key.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var inputCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("YouTube URL")
                        .font(.headline)
                    TextField("https://www.youtube.com/watch?v=…", text: $model.youtubeURL)
                        .textFieldStyle(.roundedBorder)
                        .font(.body.monospaced())
                        .onSubmit { model.start() }
                        .disabled(model.isWorking)
                }

                VStack(alignment: .leading, spacing: 7) {
                    Text("Save MP3 to")
                        .font(.headline)
                    HStack {
                        Image(systemName: "folder")
                            .foregroundStyle(.secondary)
                        Text(model.destination.path)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Spacer()
                        Button("Choose…") { model.chooseDestination() }
                            .disabled(model.isWorking)
                    }
                    .padding(9)
                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 7))
                }
            }
            .padding(8)
        }
    }

    private var actionArea: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: model.start) {
                HStack {
                    if model.isWorking {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "arrow.down.circle.fill")
                    }
                    Text(model.isWorking ? model.status : "Download MP3 & Analyze")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 5)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .keyboardShortcut(.defaultAction)
            .disabled(model.isWorking || model.youtubeURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            HStack(spacing: 6) {
                Image(systemName: model.dependenciesReady ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(model.dependenciesReady ? .green : .orange)
                Text(model.dependenciesReady
                     ? "yt-dlp and ffmpeg are ready"
                     : "Install yt-dlp and ffmpeg before downloading")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var resultArea: some View {
        if let errorMessage = model.errorMessage {
            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        } else if let result = model.analysis {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Analysis")
                        .font(.headline)
                    Spacer()
                    Label("Saved", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                }

                HStack(spacing: 14) {
                    resultTile(
                        title: "TEMPO",
                        value: formattedBPM(result.bpm),
                        subtitle: nil,
                        symbol: "metronome"
                    )
                    resultTile(
                        title: "KEY",
                        value: result.musicalKey,
                        subtitle: result.relativeMajorKey.map { "Relative major: \($0)" },
                        symbol: "music.note"
                    )
                }

                if let file = model.downloadedFile {
                    HStack {
                        Image(systemName: "music.note.list")
                        Text(file.lastPathComponent)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Spacer()
                        Button("Show in Finder") { model.revealDownloadedFile() }
                    }
                    .font(.callout)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(18)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        } else {
            Text("BPM and key will appear here after analysis.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 72)
                .background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func resultTile(title: String, value: String, subtitle: String?, symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.title3.bold())
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(15)
        .frame(maxWidth: .infinity, minHeight: 68)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
    }

    private func formattedBPM(_ bpm: Double) -> String {
        let rounded = bpm.rounded()
        if abs(bpm - rounded) < 0.05 {
            return "\(Int(rounded)) BPM"
        }
        return String(format: "%.1f BPM", bpm)
    }
}
