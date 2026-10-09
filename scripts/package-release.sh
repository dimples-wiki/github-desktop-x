#!/usr/bin/env bash
# 产出可分发的发布包：GitHub-Desktop-X-<version>-macOS-arm64.zip
# 同时打印 cask 所需的 version 与 sha256。
#
# 通道说明：固定使用 development 通道打包 —— ad-hoc 签名（本机可验可跑）、
# OAuth 协议头带 -dev 后缀（不与官方版冲突）、更新检查指向无效地址（不会被
# 官方更新服务器劫持，二开版升级走"改 submodule → 重放补丁 → 重新发布"）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/workspace"

source /Users/yoko/.local/github-desktop-x-env.sh

echo "[release] 1/4 组装 workspace（上游+补丁+功能模块）"
"$ROOT/scripts/assemble.sh" > /dev/null

if [ ! -d "$WS/node_modules" ] || [ ! -d "$WS/app/node_modules" ]; then
  echo "[release] 2/4 安装依赖（首次）"
  (cd "$WS" && yarn install --network-timeout 600000)
fi

echo "[release] 3/4 构建+打包（development 通道，ad-hoc 签名）"
(cd "$WS" && \
  RELEASE_CHANNEL=development \
  DESKTOP_E2E_UPDATES_URL=http://127.0.0.1:9/update \
  yarn build:prod) > /tmp/github-desktop-x-package.log 2>&1

APP="$WS/dist/GitHub Desktop X-darwin-arm64/GitHub Desktop X.app"
[ -d "$APP" ] || { echo "[release] 打包失败，查看 /tmp/github-desktop-x-package.log"; exit 1; }

codesign --verify --deep "$APP"
echo "[release] 签名校验通过：$(codesign -dv "$APP" 2>&1 | grep -E 'Signature=' | head -1)"

echo "[release] 4/4 压缩发布包"
VERSION="$(python3 -c "import json;print(json.load(open('$WS/app/package.json'))['version'])")"
OUT_DIR="$ROOT/dist-release"
mkdir -p "$OUT_DIR"
ZIP="$OUT_DIR/GitHub-Desktop-X-${VERSION}-macOS-arm64.zip"
rm -f "$ZIP"
ditto -ck --keepParent "$APP" "$ZIP"

SHA="$(shasum -a 256 "$ZIP" | awk '{print $1}')"
echo
echo "================= 发布物料 ================="
echo "zip:  $ZIP"
echo "version: $VERSION"
echo "sha256:  $SHA"
echo "（把 version/sha256/url 更新到 packaging/tap/Casks/github-desktop-x.rb，"
echo "  并将 zip 上传到 GitHub Releases 对应 tag）"
echo "============================================="
