// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "YouTubeMusicAnalyzer",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "MusicCore", targets: ["MusicCore"]),
        .executable(name: "YouTubeMusicAnalyzer", targets: ["YouTubeMusicAnalyzer"]),
        .executable(name: "MusicAnalyzerCLI", targets: ["MusicAnalyzerCLI"])
    ],
    targets: [
        .target(name: "MusicCore"),
        .executableTarget(
            name: "YouTubeMusicAnalyzer",
            dependencies: ["MusicCore"]
        ),
        .executableTarget(
            name: "MusicAnalyzerCLI",
            dependencies: ["MusicCore"]
        ),
        .testTarget(
            name: "MusicCoreTests",
            dependencies: ["MusicCore"]
        )
    ]
)
