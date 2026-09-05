import Foundation

public struct AudioAnalyzer: Sendable {
    private let analysisSampleRate = 11_025.0
    private let maximumDuration = 15.0 * 60.0

    public init() {}

    public func analyze(fileURL: URL) throws -> MusicAnalysis {
        let samples = try loadMonoSamples(from: fileURL)
        guard samples.count >= Int(analysisSampleRate * 8) else {
            throw MusicUtilityError.audioTooShort
        }

        let tempo = Self.estimateTempo(from: samples, sampleRate: analysisSampleRate)
        let key = Self.estimateKey(from: samples, sampleRate: analysisSampleRate)
        return MusicAnalysis(
            bpm: tempo.bpm,
            musicalKey: key.name,
            tempoConfidence: tempo.confidence,
            keyConfidence: key.confidence
        )
    }

    private func loadMonoSamples(from url: URL) throws -> [Double] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MusicUtilityError.unsupportedAudioFormat
        }
        guard let ffmpeg = ToolLocator.find("ffmpeg") else {
            throw MusicUtilityError.missingTool("ffmpeg")
        }

        let temporaryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("music-analysis-\(UUID().uuidString)")
            .appendingPathExtension("f32")
        defer { try? FileManager.default.removeItem(at: temporaryURL) }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: ffmpeg)
        process.arguments = [
            "-v", "error",
            "-y",
            "-i", url.path,
            "-vn",
            "-ac", "1",
            "-ar", String(Int(analysisSampleRate)),
            "-t", String(Int(maximumDuration)),
            "-f", "f32le",
            temporaryURL.path
        ]
        process.environment = ProcessInfo.processInfo.environment.merging(["PATH": ToolLocator.searchPath]) { _, new in new }

        let result: (output: String, error: String)
        do {
            result = try ProcessRunner.run(process)
        } catch {
            throw MusicUtilityError.processFailed(tool: "ffmpeg", message: error.localizedDescription)
        }
        guard process.terminationStatus == 0 else {
            let message = result.error.trimmingCharacters(in: .whitespacesAndNewlines)
            throw MusicUtilityError.processFailed(tool: "ffmpeg", message: !message.isEmpty ? message : "Could not decode the audio.")
        }

        guard let data = try? Data(contentsOf: temporaryURL), data.count >= MemoryLayout<Float>.size else {
            throw MusicUtilityError.unsupportedAudioFormat
        }
        let sampleCount = data.count / MemoryLayout<Float>.size
        return data.withUnsafeBytes { rawBuffer in
            Array(rawBuffer.bindMemory(to: Float.self).prefix(sampleCount)).map(Double.init)
        }
    }

    static func estimateTempo(from samples: [Double], sampleRate: Double) -> (bpm: Double, confidence: Double) {
        let blockSize = 128
        let blockCount = samples.count / blockSize
        guard blockCount > 16 else { return (120, 0) }

        var energy = [Double](repeating: 0, count: blockCount)
        var previous = samples[0]
        for block in 0..<blockCount {
            var sum = 0.0
            let start = block * blockSize
            for index in start..<(start + blockSize) {
                let highPassed = samples[index] - 0.97 * previous
                previous = samples[index]
                sum += highPassed * highPassed
            }
            energy[block] = log1p(200 * sqrt(sum / Double(blockSize)))
        }

        var onset = [Double](repeating: 0, count: blockCount)
        for index in 4..<blockCount {
            let localMean = (energy[index - 1] + energy[index - 2] + energy[index - 3] + energy[index - 4]) / 4
            onset[index] = max(0, energy[index] - localMean)
        }
        let onsetMean = onset.reduce(0, +) / Double(onset.count)
        for index in onset.indices { onset[index] -= onsetMean }

        let framesPerSecond = sampleRate / Double(blockSize)
        let minimumBPM = 65.0
        let maximumBPM = 190.0
        let minimumLag = max(2, Int((60 * framesPerSecond / maximumBPM).rounded(.down)))
        let maximumLag = min(onset.count / 3, Int((60 * framesPerSecond / minimumBPM).rounded(.up)))
        guard maximumLag > minimumLag else { return (120, 0) }

        func correlation(at lag: Int) -> Double {
            guard lag > 0, lag < onset.count else { return 0 }
            var product = 0.0
            var leftEnergy = 0.0
            var rightEnergy = 0.0
            for index in lag..<onset.count {
                let left = onset[index]
                let right = onset[index - lag]
                product += left * right
                leftEnergy += left * left
                rightEnergy += right * right
            }
            let denominator = sqrt(leftEnergy * rightEnergy)
            return denominator > 0 ? product / denominator : 0
        }

        var scores = [Int: Double]()
        var bestLag = minimumLag
        var bestScore = -Double.infinity
        for lag in minimumLag...maximumLag {
            let bpm = 60 * framesPerSecond / Double(lag)
            var score = correlation(at: lag)
            if lag * 2 <= maximumLag * 2 {
                score += 0.22 * max(0, correlation(at: lag * 2))
            }
            // A gentle musical prior resolves common half-time ambiguities without
            // forcing every song toward 120 BPM.
            score += 0.018 * exp(-pow((bpm - 118) / 42, 2))
            scores[lag] = score
            if score > bestScore {
                bestScore = score
                bestLag = lag
            }
        }

        var refinedLag = Double(bestLag)
        if let left = scores[bestLag - 1], let center = scores[bestLag], let right = scores[bestLag + 1] {
            let denominator = left - 2 * center + right
            if abs(denominator) > 0.000_001 {
                refinedLag += max(-0.5, min(0.5, 0.5 * (left - right) / denominator))
            }
        }

        let bpm = 60 * framesPerSecond / refinedLag
        let confidence = max(0, min(1, (bestScore - 0.03) / 0.32))
        return ((bpm * 10).rounded() / 10, confidence)
    }

    static func estimateKey(from samples: [Double], sampleRate: Double) -> (name: String, confidence: Double) {
        let fftSize = 4096
        let hopSize = 4096
        guard samples.count >= fftSize else { return ("Unknown", 0) }
        let window = (0..<fftSize).map { index in
            0.5 - 0.5 * cos(2 * Double.pi * Double(index) / Double(fftSize - 1))
        }
        var aggregate = [Double](repeating: 0, count: 12)
        var frameCount = 0

        var start = 0
        while start + fftSize <= samples.count {
            var real = [Double](repeating: 0, count: fftSize)
            var imaginary = [Double](repeating: 0, count: fftSize)
            var mean = 0.0
            for index in 0..<fftSize { mean += samples[start + index] }
            mean /= Double(fftSize)

            var rms = 0.0
            for index in 0..<fftSize {
                let value = samples[start + index] - mean
                rms += value * value
                real[index] = value * window[index]
            }
            rms = sqrt(rms / Double(fftSize))
            if rms > 0.000_5 {
                fft(real: &real, imaginary: &imaginary)
                var frameChroma = [Double](repeating: 0, count: 12)
                let minimumBin = max(1, Int(55 * Double(fftSize) / sampleRate))
                let maximumBin = min(fftSize / 2 - 1, Int(3_520 * Double(fftSize) / sampleRate))
                for bin in minimumBin...maximumBin {
                    let frequency = Double(bin) * sampleRate / Double(fftSize)
                    let midi = 69 + 12 * log2(frequency / 440)
                    let pitchClass = ((Int(midi.rounded()) % 12) + 12) % 12
                    let magnitude = hypot(real[bin], imaginary[bin])
                    frameChroma[pitchClass] += sqrt(magnitude) / sqrt(frequency)
                }
                let total = frameChroma.reduce(0, +)
                if total > 0 {
                    for pitchClass in 0..<12 {
                        aggregate[pitchClass] += frameChroma[pitchClass] / total
                    }
                    frameCount += 1
                }
            }
            start += hopSize
        }

        guard frameCount > 0 else { return ("Unknown", 0) }
        return detectKey(fromChroma: aggregate)
    }

    static func detectKey(fromChroma chroma: [Double]) -> (name: String, confidence: Double) {
        guard chroma.count == 12 else { return ("Unknown", 0) }
        let majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        let minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        let names = ["C", "C♯ / D♭", "D", "D♯ / E♭", "E", "F", "F♯ / G♭", "G", "G♯ / A♭", "A", "A♯ / B♭", "B"]

        func pearson(_ values: [Double], _ profile: [Double], tonic: Int) -> Double {
            let valueMean = values.reduce(0, +) / 12
            let profileMean = profile.reduce(0, +) / 12
            var numerator = 0.0
            var left = 0.0
            var right = 0.0
            for pitchClass in 0..<12 {
                let centeredValue = values[pitchClass] - valueMean
                let centeredProfile = profile[(pitchClass - tonic + 12) % 12] - profileMean
                numerator += centeredValue * centeredProfile
                left += centeredValue * centeredValue
                right += centeredProfile * centeredProfile
            }
            let denominator = sqrt(left * right)
            return denominator > 0 ? numerator / denominator : 0
        }

        var candidates: [(score: Double, tonic: Int, mode: String)] = []
        for tonic in 0..<12 {
            candidates.append((pearson(chroma, majorProfile, tonic: tonic), tonic, "major"))
            candidates.append((pearson(chroma, minorProfile, tonic: tonic), tonic, "minor"))
        }
        candidates.sort { $0.score > $1.score }
        guard let best = candidates.first else { return ("Unknown", 0) }
        let runnerUp = candidates.dropFirst().first?.score ?? 0
        let separation = max(0, best.score - runnerUp)
        let confidence = max(0, min(1, 0.55 * max(0, best.score) + 2.2 * separation))
        return ("\(names[best.tonic]) \(best.mode)", confidence)
    }

    private static func fft(real: inout [Double], imaginary: inout [Double]) {
        let count = real.count
        var j = 0
        for i in 1..<count {
            var bit = count >> 1
            while j & bit != 0 {
                j ^= bit
                bit >>= 1
            }
            j ^= bit
            if i < j {
                real.swapAt(i, j)
                imaginary.swapAt(i, j)
            }
        }

        var length = 2
        while length <= count {
            let angle = -2 * Double.pi / Double(length)
            let stepReal = cos(angle)
            let stepImaginary = sin(angle)
            let half = length / 2
            var offset = 0
            while offset < count {
                var twiddleReal = 1.0
                var twiddleImaginary = 0.0
                for index in 0..<half {
                    let even = offset + index
                    let odd = even + half
                    let oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary
                    let oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal
                    real[odd] = real[even] - oddReal
                    imaginary[odd] = imaginary[even] - oddImaginary
                    real[even] += oddReal
                    imaginary[even] += oddImaginary

                    let nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary
                    twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal
                    twiddleReal = nextReal
                }
                offset += length
            }
            length <<= 1
        }
    }
}
