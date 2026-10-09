#!/usr/bin/env bash
# 将主仓库的 cask 同步到独立 tap 仓库（dimples-wiki/homebrew-githubx）并推送。
# 前提：tap 仓库已 clone 到 ~/github-desktop-x-tap。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAP="${TAP_DIR:-$HOME/github-desktop-x-tap}"

[ -d "$TAP/.git" ] || { echo "tap 仓库不存在：$TAP（先 git clone dimples-wiki/homebrew-githubx）"; exit 1; }

cp "$ROOT/Casks/githubx.rb" "$TAP/Casks/githubx.rb"
cd "$TAP"
if git diff --quiet; then
  echo "[publish-tap] cask 无变化"
else
  VERSION="$(sed -n 's/  version "\([^"]*\)"/\1/p' Casks/githubx.rb)"
  git add -A && git commit -q -m "githubx $VERSION" && git push
  echo "[publish-tap] 已推送 githubx $VERSION"
fi
