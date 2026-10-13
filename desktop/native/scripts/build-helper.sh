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
# Fretboard models (CoreML fp16) -> compiled dist/FretTrackerV*.mlmodelc
# V1 = YOLO11s-pose (AGPL-3.0), V3 = FretNet ResNet-50 heatmaps (permissive); see desktop/README.md.
for MODEL in FretTrackerV1 FretTrackerV3 FretTrackerV4Q832; do
  rm -rf "$PROJECT_DIRECTORY/dist/$MODEL.mlmodelc"
  xcrun coremlcompiler compile "$PROJECT_DIRECTORY/models/$MODEL.mlpackage" "$PROJECT_DIRECTORY/dist/" >/dev/null
  test -d "$PROJECT_DIRECTORY/dist/$MODEL.mlmodelc"
done
