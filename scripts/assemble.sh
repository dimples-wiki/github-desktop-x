#!/usr/bin/env bash
# 组装 workspace = upstream 树 + framework/ 插件框架 + patches/ 接线补丁 + feature/ 插件 overlay
# 幂等：重复执行安全，且保留 workspace/node_modules 以避免重复安装依赖。
# 组装完成后会在 workspace 里创建一个基线 git 仓库（上游构建脚本依赖 git 元数据，
# 同时也是 export-patches.sh 生成补丁的 diff 基准 = 纯上游 + 框架层）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/workspace"
UP="$ROOT/upstream"

command -v rsync >/dev/null || { echo "需要 rsync"; exit 1; }

# 1) 清空 workspace（保留根级与 app/ 下的 node_modules，避免重复安装依赖）
if [ -d "$WS" ]; then
  if [ -d "$WS/app/node_modules" ]; then
    mv "$WS/app/node_modules" "$WS/.keep-app-node-modules"
  fi
  find "$WS" -mindepth 1 -maxdepth 1 \
    ! -name node_modules ! -name '.keep-app-node-modules' \
    -exec rm -rf {} +
  mkdir -p "$WS/app"
  if [ -d "$WS/.keep-app-node-modules" ]; then
    mv "$WS/.keep-app-node-modules" "$WS/app/node_modules"
  fi
else
  mkdir -p "$WS"
fi

# 2) 从 submodule 当前 checkout（detached 于官方 tag）导出干净工作树
(cd "$UP" && git archive --format=tar HEAD) | tar -x -C "$WS"
echo "[assemble] upstream tree: $(git -C "$UP" describe --tags 2>/dev/null || git -C "$UP" rev-parse --short HEAD)"

# 2b) 上游自身的子模块（gemoji 等）不在 git archive 中，需从 upstream/ 同步
for sub in gemoji app/static/common/gitignore app/static/common/choosealicense.com; do
  if [ ! -d "$UP/$sub" ] || [ -z "$(ls -A "$UP/$sub" 2>/dev/null)" ]; then
    echo "[assemble] 错误: upstream 子模块 $sub 为空，请先在上游执行 git submodule update --init" >&2
    exit 1
  fi
  mkdir -p "$WS/$(dirname "$sub")"
  rsync -a "$UP/$sub/" "$WS/$sub/"
done

# 2c) 注入插件框架（framework/ = 上游侧通用扩展点层；随基线提交，
#     使接线补丁可以 import 框架，而框架本身不进入补丁 diff）
if [ -d "$ROOT/framework/app" ]; then
  echo "[assemble] overlay extension framework"
  rsync -a "$ROOT/framework/" "$WS/"
fi

# 3) 创建基线 git 仓库（纯上游内容 + 框架层）：
#    - 上游 script/build.ts 依赖 .git 注入版本等元数据；
#    - git apply 需在本仓库内执行，否则会向上误发现父仓库导致补丁被静默跳过；
#    - export-patches.sh 以 baseline 提交为基准生成接线补丁。
#    插件功能模块通过 .git/info/exclude 排除，保证 diff 只含框架接线改动。
cd "$WS"
git init -q
cat > .git/info/exclude <<'EOF'
# plugin feature overlay (owned by the parent repo, not part of glue patches)
/app/src/ui/history/commits-*
/app/styles/ui/history/_commits-*
/app/test/unit/commits-*
/app/src/lib/extensions/built-in/
EOF
git add -A
git -c user.name=assemble -c user.email=assemble@local commit -qm "baseline: upstream $(git -C "$UP" describe --tags 2>/dev/null || echo HEAD) + extension framework" >/dev/null

# 4) 应用接线补丁（顺序由 patches/series.txt 决定；此时 workspace 已是独立 git 仓库）
if [ -f "$ROOT/patches/series.txt" ]; then
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    echo "[assemble] applying patch: $p"
    git apply --whitespace=nowarn "$ROOT/patches/$p"
  done < "$ROOT/patches/series.txt"
else
  echo "[assemble] no patches/series.txt — 基线组装（无接线）"
fi

# 5) 叠加插件功能模块（全部为新增文件；路径已被 info/exclude 排除）
shopt -s nullglob
for mod in "$ROOT"/feature/*/; do
  echo "[assemble] overlay plugin module: $(basename "$mod")"
  rsync -a "$mod" "$WS/"
done

echo "[assemble] done → $WS"
