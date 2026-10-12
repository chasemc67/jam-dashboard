import Accelerate
import CoreML
import CoreVideo
import FretCore
import Foundation

// FretTrackerCLI: CoreML fretboard tracker helper for the Jam Dashboard Electron app.
//
//   FretTrackerCLI --model FretTrackerV1.mlmodelc [--compute-units all|cpuAndNeuralEngine|cpuAndGPU|cpuOnly]
//                  [--frets N] [--emit-kpts]
//   FretTrackerCLI --bench N --model FretTrackerV1.mlmodelc [--compute-units ...]
//
// stdin: binary frames (32-byte little-endian header "FRT1", frameId u32, t f64, srcWidth u32, srcHeight u32,
// flags u32 (bit0 mirrored, bit1 reset), payloadBytes u32 = 640*640*4, then 640x640 RGBA8 letterboxed canonical frame).
// stdout: one JSON line per frame. See desktop/native/README.md.

let inputSize = modelInputSize
let payloadSize = inputSize * inputSize * 4
let headerSize = 32

// MARK: - JSON output

struct JSONLine {
    var parts: [String] = []
    mutating func raw(_ key: String, _ value: String) { parts.append("\"\(key)\":\(value)") }
    mutating func str(_ key: String, _ value: String) { raw(key, jsonString(value)) }
    mutating func num(_ key: String, _ value: Double?) { raw(key, jsonNumber(value)) }
    mutating func int(_ key: String, _ value: Int?) { raw(key, value.map { String($0) } ?? "null") }
    mutating func bool(_ key: String, _ value: Bool) { raw(key, value ? "true" : "false") }
    var text: String { "{" + parts.joined(separator: ",") + "}" }
}

func jsonNumber(_ v: Double?) -> String {
    guard let v, v.isFinite else { return "null" }
    if v == v.rounded() && abs(v) < 1e15 { return String(Int64(v)) }
    return "\(v)"
}

func jsonString(_ s: String) -> String {
    var out = "\""
    for ch in s.unicodeScalars {
        switch ch {
        case "\"": out += "\\\""
        case "\\": out += "\\\\"
        case "\n": out += "\\n"
        case "\r": out += "\\r"
        case "\t": out += "\\t"
        default:
            if ch.value < 0x20 { out += String(format: "\\u%04x", ch.value) } else { out.unicodeScalars.append(ch) }
        }
    }
    return out + "\""
}

func emitLine(_ line: String) {
    var s = line
    s.append("\n")
    s.withCString { ptr in
        _ = fputs(ptr, stdout)
    }
    fflush(stdout)
}

func fail(_ message: String) -> Never {
    var j = JSONLine()
    j.str("type", "error")
    j.str("message", message)
    emitLine(j.text)
    exit(1)
}

// MARK: - Arguments

var modelPath: String?
var computeUnitsName = "all"
var fixedFrets: Int?
var benchCount: Int?
var emitKpts = false
do {
    var args = Array(CommandLine.arguments.dropFirst())
    func value(_ flag: String) -> String {
        guard !args.isEmpty else { fail("missing value for \(flag)") }
        return args.removeFirst()
    }
    while !args.isEmpty {
        let a = args.removeFirst()
        switch a {
        case "--model": modelPath = value(a)
        case "--compute-units": computeUnitsName = value(a)
        case "--frets":
            guard let n = Int(value(a)), n >= 12, n <= 24 else { fail("--frets must be an integer 12...24") }
            fixedFrets = n
        case "--bench":
            guard let n = Int(value(a)), n > 0 else { fail("--bench needs a positive count") }
            benchCount = n
        case "--emit-kpts": emitKpts = true
        default: fail("unknown argument \(a). Usage: FretTrackerCLI --model <FretTrackerV1.mlmodelc> "
            + "[--compute-units all|cpuAndNeuralEngine|cpuAndGPU|cpuOnly] [--frets N] [--bench N]")
        }
    }
}

let computeUnits: MLComputeUnits
switch computeUnitsName {
case "all": computeUnits = .all
case "cpuAndNeuralEngine": computeUnits = .cpuAndNeuralEngine
case "cpuAndGPU": computeUnits = .cpuAndGPU
case "cpuOnly": computeUnits = .cpuOnly
default: fail("bad --compute-units \(computeUnitsName)")
}
guard let modelPath else { fail("--model <path to .mlmodelc> is required") }

// MARK: - Model

// Run at user-interactive QoS: when spawned by Electron the helper may otherwise inherit a low QoS and be scheduled on
// efficiency cores (slower model dispatch and post-processing).
_ = pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0)

func nowMs() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1e6 }

let loadStart = nowMs()
let mlModel: MLModel
do {
    let config = MLModelConfiguration()
    config.computeUnits = computeUnits
    var url = URL(fileURLWithPath: modelPath)
    if url.pathExtension == "mlpackage" || url.pathExtension == "mlmodel" {
        url = try MLModel.compileModel(at: url)  // development convenience; the app ships a compiled .mlmodelc
    }
    mlModel = try MLModel(contentsOf: url, configuration: config)
} catch {
    fail("could not load model at \(modelPath): \(error.localizedDescription)")
}
let loadMs = nowMs() - loadStart

let inputName: String = {
    let inputs = mlModel.modelDescription.inputDescriptionsByName
    if inputs["image"] != nil { return "image" }
    return inputs.first(where: { $0.value.type == .image })?.key ?? "image"
}()
let outputName: String = {
    let outputs = mlModel.modelDescription.outputDescriptionsByName
    if outputs["var_1348"] != nil { return "var_1348" }
    return outputs.first(where: { $0.value.type == .multiArray })?.key ?? "var_1348"
}()

// MARK: - Pixel buffer

var pixelBuffer: CVPixelBuffer?
let pbAttrs: [String: Any] = [
    kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
    kCVPixelBufferCGImageCompatibilityKey as String: true,
]
guard CVPixelBufferCreate(kCFAllocatorDefault, inputSize, inputSize, kCVPixelFormatType_32BGRA,
                          pbAttrs as CFDictionary, &pixelBuffer) == kCVReturnSuccess, let pixelBuffer
else { fail("CVPixelBufferCreate failed") }

/// RGBA8 (640x640, row-major) -> BGRA pixel buffer.
func fillPixelBuffer() {
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    payloadArray.withUnsafeMutableBytes { rgba in
    var src = vImage_Buffer(data: rgba.baseAddress, height: vImagePixelCount(inputSize), width: vImagePixelCount(inputSize),
                            rowBytes: inputSize * 4)
    var dst = vImage_Buffer(data: CVPixelBufferGetBaseAddress(pixelBuffer), height: vImagePixelCount(inputSize),
                            width: vImagePixelCount(inputSize), rowBytes: CVPixelBufferGetBytesPerRow(pixelBuffer))
    let map: [UInt8] = [2, 1, 0, 3]
    vImagePermuteChannels_ARGB8888(&src, &dst, map, vImage_Flags(kvImageNoFlags))
    }
}

// MARK: - Output decoding

@inline(__always)
func halfToFloat(_ bits: UInt16) -> Float {
    let sign = UInt32(bits & 0x8000) << 16
    let exp = Int((bits >> 10) & 0x1F)
    let frac = UInt32(bits & 0x3FF)
    if exp == 0 {
        if frac == 0 { return Float(bitPattern: sign) }
        let v = Float(frac) * Float(pow(2.0, -24.0))
        return sign != 0 ? -v : v
    }
    if exp == 31 { return Float(bitPattern: sign | 0x7F80_0000 | (frac << 13)) }
    return Float(bitPattern: sign | (UInt32(exp - 15 + 127) << 23) | (frac << 13))
}

func decodeOutput(_ arr: MLMultiArray) throws -> Detection {
    let shape = arr.shape.map { $0.intValue }
    let strides = arr.strides.map { $0.intValue }
    guard shape.count >= 2, shape[shape.count - 2] == 155 else {
        throw NSError(domain: "FretTrackerCLI", code: 3,
                      userInfo: [NSLocalizedDescriptionKey: "unexpected output shape \(shape)"])
    }
    let anchors = shape[shape.count - 1]
    let cs = strides[strides.count - 2], ast = strides[strides.count - 1]
    switch arr.dataType {
    case .float32:
        return arr.withUnsafeBufferPointer(ofType: Float.self) { p in
            decode(anchorCount: anchors) { c, a in p[c * cs + a * ast] }
        }
    case .float16:
        return arr.withUnsafeBytes { raw in
            let p = raw.bindMemory(to: UInt16.self)
            return decode(anchorCount: anchors) { c, a in halfToFloat(p[c * cs + a * ast]) }
        }
    case .double:
        return arr.withUnsafeBufferPointer(ofType: Double.self) { p in
            decode(anchorCount: anchors) { c, a in Float(p[c * cs + a * ast]) }
        }
    default:
        throw NSError(domain: "FretTrackerCLI", code: 4,
                      userInfo: [NSLocalizedDescriptionKey: "unsupported output data type \(arr.dataType.rawValue)"])
    }
}

func predict() throws -> MLMultiArray {
    let input = try MLDictionaryFeatureProvider(dictionary: [inputName: MLFeatureValue(pixelBuffer: pixelBuffer)])
    let out = try mlModel.prediction(from: input)
    guard let arr = out.featureValue(for: outputName)?.multiArrayValue else {
        throw NSError(domain: "FretTrackerCLI", code: 5, userInfo: [NSLocalizedDescriptionKey: "missing output \(outputName)"])
    }
    return arr
}

// MARK: - Per-frame pipeline

let tracker = FretboardTracker(frets: fixedFrets)
var payloadArray = [UInt8](repeating: 0, count: payloadSize)  // RGBA8 frame, reused (no copy into GrayImage)
let header = UnsafeMutableRawPointer.allocate(byteCount: headerSize, alignment: 8)

struct FrameTimings {
    var prep = 0.0, model = 0.0, post = 0.0, total = 0.0
}

func processFrame(srcWidth: Int, srcHeight: Int, mirrored: Bool, t: Double?) throws -> (TrackState, FrameTimings) {
    var tm = FrameTimings()
    let t0 = nowMs()
    fillPixelBuffer()
    let t1 = nowMs()
    let out = try predict()
    let t2 = nowMs()
    let det = try decodeOutput(out)
    let lb = Letterbox(width: srcWidth, height: srcHeight, size: inputSize)
    let k = unletterbox(det.kpts, lb, clip: true)
    var state = tracker.update(kpts: k, width: srcWidth, height: srcHeight, mirrored: mirrored, t: t) {
        GrayImage(letterboxed: payloadArray, letterbox: lb, rgba: true)
    }
    state.boardScore = Double(det.score)
    let t3 = nowMs()
    tm.prep = t1 - t0
    tm.model = t2 - t1
    tm.post = t3 - t2
    tm.total = t3 - t0
    return (state, tm)
}

func frameJSON(id: UInt32, state: TrackState, timings: FrameTimings) -> String {
    var j = JSONLine()
    j.str("type", "frame")
    j.raw("id", String(id))
    j.num("t", state.t)
    j.bool("valid", state.valid)
    j.bool("held", state.held)
    j.int("nFrets", state.nFrets)
    j.num("boardScore", state.boardScore)
    if let m = state.model, m.H.isFinite, m.H[2, 2] != 0 {
        let H = m.H.normalized
        j.raw("H", "[" + H.m.map { jsonNumber($0) }.joined(separator: ",") + "]")
        let wires = state.wires().map { a, b in
            "[[\(jsonNumber(a.x)),\(jsonNumber(a.y))],[\(jsonNumber(b.x)),\(jsonNumber(b.y))]]"
        }
        j.raw("wires", "[" + wires.joined(separator: ",") + "]")
        j.num("tau", m.tau)
    } else {
        j.raw("H", "null")
        j.raw("wires", "null")
        j.num("tau", defaultTau)
    }
    j.int("anchors", state.anchorCount)
    j.num("rmsePx", state.rmsePx)
    j.int("endEstimate", state.endEstimate)
    if emitKpts {
        j.raw("kpts", "[" + state.kpts.map { jsonNumber(Double($0)) }.joined(separator: ",") + "]")
    }
    j.raw("timingsMs", "{\"prep\":\(jsonNumber(timings.prep)),\"model\":\(jsonNumber(timings.model)),"
        + "\"post\":\(jsonNumber(timings.post)),\"total\":\(jsonNumber(timings.total))}")
    return j.text
}

// MARK: - Bench mode

func percentile(_ v: [Double], _ p: Double) -> Double {
    let s = v.sorted()
    guard !s.isEmpty else { return .nan }
    let pos = p * Double(s.count - 1)
    let lo = Int(pos.rounded(.down)), hi = min(lo + 1, s.count - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - Double(lo))
}

func runBench(_ n: Int) -> Never {
    // synthetic letterboxed 1920x1080 frame: gray pad with a textured content band
    for y in 0..<inputSize {
        for x in 0..<inputSize {
            let i = (y * inputSize + x) * 4
            let content = y >= 140 && y < 500
            let v: UInt8 = content ? UInt8((x * 7 + y * 3) & 0xFF) : letterboxPadValue
            payloadArray[i] = v
            payloadArray[i + 1] = content ? UInt8((x + y) & 0xFF) : v
            payloadArray[i + 2] = v
            payloadArray[i + 3] = 255
        }
    }
    var model: [Double] = [], post: [Double] = [], total: [Double] = [], prep: [Double] = []
    do {
        _ = try processFrame(srcWidth: 1920, srcHeight: 1080, mirrored: false, t: 0)  // warm-up
        for i in 0..<n {
            let (_, tm) = try processFrame(srcWidth: 1920, srcHeight: 1080, mirrored: false, t: Double(i + 1) / 30)
            prep.append(tm.prep)
            model.append(tm.model)
            post.append(tm.post)
            total.append(tm.total)
        }
    } catch {
        fail("bench failed: \(error.localizedDescription)")
    }
    var j = JSONLine()
    j.str("type", "bench")
    j.int("frames", n)
    j.str("computeUnits", computeUnitsName)
    j.num("loadMs", loadMs)
    for (name, v) in [("prep", prep), ("model", model), ("post", post), ("total", total)] {
        j.raw(name, "{\"median\":\(jsonNumber(percentile(v, 0.5))),\"p95\":\(jsonNumber(percentile(v, 0.95)))}")
    }
    emitLine(j.text)
    exit(0)
}

// MARK: - Main loop

var ready = JSONLine()
ready.str("type", "ready")
ready.str("computeUnits", computeUnitsName)
ready.num("loadMs", loadMs)

if let benchCount { runBench(benchCount) }
emitLine(ready.text)

/// Read exactly `count` bytes; returns the number read (< count only at EOF).
func readFully(_ buf: UnsafeMutableRawPointer, _ count: Int) -> Int {
    var got = 0
    while got < count {
        let r = read(STDIN_FILENO, buf + got, count - got)
        if r > 0 {
            got += r
        } else if r == 0 {
            break
        } else if errno == EINTR {
            continue
        } else {
            fail("stdin read error \(errno)")
        }
    }
    return got
}

func u32(_ off: Int) -> UInt32 { UInt32(littleEndian: header.loadUnaligned(fromByteOffset: off, as: UInt32.self)) }

while true {
    let h = readFully(header, headerSize)
    if h == 0 { exit(0) }
    if h < headerSize { fail("truncated frame header (\(h) bytes)") }
    let magic = header.loadUnaligned(fromByteOffset: 0, as: UInt32.self)
    if magic != UInt32(littleEndian: 0x3154_5246) {  // "FRT1"
        fail("bad frame magic")
    }
    let frameId = u32(4)
    let t = Double(bitPattern: UInt64(littleEndian: header.loadUnaligned(fromByteOffset: 8, as: UInt64.self)))
    let srcWidth = Int(u32(16)), srcHeight = Int(u32(20))
    let flags = u32(24)
    let payloadBytes = Int(u32(28))
    if payloadBytes != payloadSize { fail("payloadBytes \(payloadBytes) != \(payloadSize)") }
    let got = payloadArray.withUnsafeMutableBytes { readFully($0.baseAddress!, payloadSize) }
    if got < payloadSize { fail("truncated frame payload") }
    if srcWidth <= 0 || srcHeight <= 0 || srcWidth > 16384 || srcHeight > 16384 {
        fail("bad source size \(srcWidth)x\(srcHeight)")
    }
    if flags & 2 != 0 { tracker.reset() }
    do {
        let (state, tm) = try processFrame(srcWidth: srcWidth, srcHeight: srcHeight, mirrored: flags & 1 != 0,
                                           t: t.isFinite ? t : nil)
        emitLine(frameJSON(id: frameId, state: state, timings: tm))
    } catch {
        fail("prediction failed: \(error.localizedDescription)")
    }
}
