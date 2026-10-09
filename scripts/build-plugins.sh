#!/usr/bin/env bash
# Build all dynamic plugins: plugins/<name>/src -> plugins/<name>/renderer.js
# (IIFE, evaluated by the host at runtime). Also runs plugin unit tests
# (node:test style) if present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS="$ROOT/plugins"
ESBUILD="$ROOT/workspace/node_modules/esbuild/bin/esbuild"

source /Users/yoko/.local/github-desktop-x-env.sh
command -v node >/dev/null || { echo "node is required"; exit 1; }
[ -x "$ESBUILD" ] || { echo "esbuild missing (run yarn install in workspace first)"; exit 1; }

for plugin_dir in "$PLUGINS"/*/; do
  plugin_dir="${plugin_dir%/}"
  name="$(basename "$plugin_dir")"
  [ -d "$plugin_dir/src" ] || continue

  echo "[build-plugins] building $name"

  entry=""
  for candidate in "$plugin_dir/src/index.tsx" "$plugin_dir/src/index.ts"; do
    if [ -f "$candidate" ]; then
      entry="$candidate"
      break
    fi
  done
  if [ -z "$entry" ]; then
    echo "[build-plugins] no src/index.ts[x] in $name"
    exit 1
  fi

  node "$ESBUILD" "$entry" \
    --bundle \
    --format=iife \
    --platform=browser \
    --target=es2022 \
    --jsx=transform \
    --jsx-factory=React.createElement \
    --jsx-fragment=React.Fragment \
    --legal-comments=none \
    --sourcemap=external \
    --outfile="$plugin_dir/renderer.js"

  # Optional tests: plugins/<name>/test/*.test.ts (node:test style)
  for test in "$plugin_dir"/test/*.test.ts; do
    [ -e "$test" ] || continue
    out="/tmp/github-desktop-x-plugin-test-$name.js"
    node "$ESBUILD" "$test" --bundle --platform=node --format=cjs --outfile="$out"
    echo "[build-plugins] running tests: $name"
    node "$out" > /tmp/github-desktop-x-plugin-test-output.txt 2>&1 || {
      cat /tmp/github-desktop-x-plugin-test-output.txt
      echo "[build-plugins] tests FAILED: $name"
      exit 1
    }
    grep -E "tests |pass |fail " /tmp/github-desktop-x-plugin-test-output.txt | sed 's/^/    /' || true
  done
done

echo "[build-plugins] all plugins built"
