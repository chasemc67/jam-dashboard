#!/bin/bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIRECTORY="$(cd "$SCRIPT_DIRECTORY/.." && pwd)"
APP_NAME="YouTube Music Analyzer"
APP_DIRECTORY="$PROJECT_DIRECTORY/dist/$APP_NAME.app"
BUILD_ARCH="${JAM_DESKTOP_ARCH:-$(uname -m)}"
BUILD_DIRECTORY="$PROJECT_DIRECTORY/.build/desktop-$BUILD_ARCH"

cd "$PROJECT_DIRECTORY"
MODULE_CACHE="$PROJECT_DIRECTORY/.build/ModuleCache"
env \
    CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" \
    SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" \
    swift build --disable-sandbox --scratch-path "$BUILD_DIRECTORY" -c release --arch "$BUILD_ARCH" --product YouTubeMusicAnalyzer

rm -rf "$APP_DIRECTORY"
mkdir -p "$APP_DIRECTORY/Contents/MacOS" "$APP_DIRECTORY/Contents/Resources"
cp "$BUILD_DIRECTORY/release/YouTubeMusicAnalyzer" "$APP_DIRECTORY/Contents/MacOS/YouTubeMusicAnalyzer"
cp "$PROJECT_DIRECTORY/Resources/Info.plist" "$APP_DIRECTORY/Contents/Info.plist"
cp "$PROJECT_DIRECTORY/Resources/AppIcon.icns" "$APP_DIRECTORY/Contents/Resources/AppIcon.icns"
chmod +x "$APP_DIRECTORY/Contents/MacOS/YouTubeMusicAnalyzer"
codesign --force --deep --sign - "$APP_DIRECTORY"

echo "Built: $APP_DIRECTORY"
