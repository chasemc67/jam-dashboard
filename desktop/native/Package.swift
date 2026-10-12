// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "YouTubeMusicAnalyzer",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "MusicCore", targets: ["MusicCore"]),
        .library(name: "FretCore", targets: ["FretCore"]),
        .executable(name: "MusicAnalyzerCLI", targets: ["MusicAnalyzerCLI"]),
        .executable(name: "FretTrackerCLI", targets: ["FretTrackerCLI"])
    ],
    targets: [
        .target(name: "MusicCore"),
        .target(name: "FretCore"),
        .executableTarget(
            name: "MusicAnalyzerCLI",
            dependencies: ["MusicCore"]
        ),
        .executableTarget(
            name: "FretTrackerCLI",
            dependencies: ["FretCore"],
            linkerSettings: [.linkedFramework("CoreML"), .linkedFramework("CoreVideo"), .linkedFramework("Accelerate")]
        ),
        .testTarget(
            name: "MusicCoreTests",
            dependencies: ["MusicCore"]
        ),
        .testTarget(
            name: "FretCoreTests",
            dependencies: ["FretCore"],
            resources: [.copy("Fixtures")]
        )
    ]
)
