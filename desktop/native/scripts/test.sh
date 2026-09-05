#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
MODULE_CACHE="$PWD/.build/ModuleCache"
env CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" \
  swift test --disable-sandbox
