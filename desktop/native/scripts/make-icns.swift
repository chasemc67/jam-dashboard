#!/usr/bin/env swift

import Foundation

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write(Data("Usage: make-icns.swift ICONSET_DIRECTORY OUTPUT.icns\n".utf8))
    exit(2)
}

let iconsetURL = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let entries = [
    (type: "icp4", file: "icon_16x16.png"),
    (type: "icp5", file: "icon_32x32.png"),
    (type: "icp6", file: "icon_32x32@2x.png"),
    (type: "ic07", file: "icon_128x128.png"),
    (type: "ic08", file: "icon_256x256.png"),
    (type: "ic09", file: "icon_512x512.png"),
    (type: "ic10", file: "icon_512x512@2x.png")
]

func bigEndianData(_ value: UInt32) -> Data {
    var bigEndian = value.bigEndian
    return withUnsafeBytes(of: &bigEndian) { Data($0) }
}

do {
    var chunks = Data()
    for entry in entries {
        let imageURL = iconsetURL.appendingPathComponent(entry.file)
        let imageData = try Data(contentsOf: imageURL)
        guard let typeData = entry.type.data(using: .ascii), typeData.count == 4 else {
            throw CocoaError(.fileWriteUnknown)
        }
        chunks.append(typeData)
        chunks.append(bigEndianData(UInt32(imageData.count + 8)))
        chunks.append(imageData)
    }

    var fileData = Data("icns".utf8)
    fileData.append(bigEndianData(UInt32(chunks.count + 8)))
    fileData.append(chunks)
    try fileData.write(to: outputURL, options: .atomic)
    print("Created \(outputURL.path)")
} catch {
    FileHandle.standardError.write(Data("Could not create ICNS: \(error.localizedDescription)\n".utf8))
    exit(1)
}
