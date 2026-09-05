#!/bin/bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "$0")" && pwd)"
ICON_WORK="$(mktemp -d "${TMPDIR:-/tmp}/jam-icon.XXXXXX")"
trap 'rm -rf "$ICON_WORK"' EXIT
ICONSET="$ICON_WORK/JamDashboard.iconset"
mkdir -p "$ICONSET"

# Produce Apple's standard 1x/2x icon representations from the original artwork.
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$SCRIPT_DIRECTORY/assets/JamDashboard-source.png" \
    --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  sips -z "$double_size" "$double_size" "$SCRIPT_DIRECTORY/assets/JamDashboard-source.png" \
    --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

env CLANG_MODULE_CACHE_PATH="$ICON_WORK/ModuleCache" \
  swift "$SCRIPT_DIRECTORY/native/scripts/make-icns.swift" \
  "$ICONSET" "$SCRIPT_DIRECTORY/assets/JamDashboard.icns"
echo "Created $SCRIPT_DIRECTORY/assets/JamDashboard.icns"
