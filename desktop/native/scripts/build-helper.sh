#!/bin/bash
set -euo pipefail
PROJECT_DIRECTORY="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_ARCH="${JAM_DESKTOP_ARCH:-$(uname -m)}"
BUILD_DIRECTORY="$PROJECT_DIRECTORY/.build/desktop-$BUILD_ARCH"
MODULE_CACHE="$PROJECT_DIRECTORY/.build/ModuleCache"
cd "$PROJECT_DIRECTORY"
env CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" \
  swift build --disable-sandbox --scratch-path "$BUILD_DIRECTORY" -c release \
    --arch "$BUILD_ARCH" --product MusicAnalyzerCLI
mkdir -p "$PROJECT_DIRECTORY/dist"
cp "$BUILD_DIRECTORY/release/MusicAnalyzerCLI" "$PROJECT_DIRECTORY/dist/MusicAnalyzerCLI"
codesign --force --sign - "$PROJECT_DIRECTORY/dist/MusicAnalyzerCLI"
