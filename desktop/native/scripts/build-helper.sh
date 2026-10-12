#!/bin/bash
set -euo pipefail
PROJECT_DIRECTORY="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_ARCH="${JAM_DESKTOP_ARCH:-$(uname -m)}"
BUILD_DIRECTORY="$PROJECT_DIRECTORY/.build/desktop-$BUILD_ARCH"
MODULE_CACHE="$PROJECT_DIRECTORY/.build/ModuleCache"
cd "$PROJECT_DIRECTORY"
for PRODUCT in MusicAnalyzerCLI FretTrackerCLI; do
  env CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" \
    swift build --disable-sandbox --scratch-path "$BUILD_DIRECTORY" -c release \
      --arch "$BUILD_ARCH" --product "$PRODUCT"
done
mkdir -p "$PROJECT_DIRECTORY/dist"
for PRODUCT in MusicAnalyzerCLI FretTrackerCLI; do
  cp "$BUILD_DIRECTORY/release/$PRODUCT" "$PROJECT_DIRECTORY/dist/$PRODUCT"
  codesign --force --sign - "$PROJECT_DIRECTORY/dist/$PRODUCT"
done
# Fretboard pose model (YOLO11s-pose, CoreML fp16) -> compiled dist/FretTrackerV1.mlmodelc
rm -rf "$PROJECT_DIRECTORY/dist/FretTrackerV1.mlmodelc"
xcrun coremlcompiler compile "$PROJECT_DIRECTORY/models/FretTrackerV1.mlpackage" "$PROJECT_DIRECTORY/dist/" >/dev/null
test -d "$PROJECT_DIRECTORY/dist/FretTrackerV1.mlmodelc"
