#!/usr/bin/env bash
# Install built plugins into the app's plugins directory (<userData>/plugins).
# Usage: install-plugins.sh [userDataDir] (default: .runtime/user-data, the
# user-data dir used by the GUI automation driver).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_BASE="${1:-$ROOT/.runtime/user-data/plugins}"

for plugin_dir in "$ROOT"/plugins/*/; do
  plugin_dir="${plugin_dir%/}"
  name="$(basename "$plugin_dir")"
  if [ ! -f "$plugin_dir/renderer.js" ]; then
    echo "[install-plugins] skip $name (not built; run build-plugins.sh first)"
    continue
  fi
  mkdir -p "$DEST_BASE/$name"
  cp "$plugin_dir/plugin.json" "$DEST_BASE/$name/"
  cp "$plugin_dir/renderer.js" "$DEST_BASE/$name/"
  echo "[install-plugins] installed $name -> $DEST_BASE/$name"
done
