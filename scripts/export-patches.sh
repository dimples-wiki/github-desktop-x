#!/usr/bin/env bash
# 从 workspace 的胶水改动（相对 baseline 提交）导出补丁序列到 patches/，
# 并生成 patches/series.txt。每个补丁按文件组拆分，保证补丁与架构文档对应：
#   0001 app-state        —— RepositorySectionTab 枚举新增 Commits
#   0002 repository-view  —— TabBar/路由/焦点接线（注册点）
#   0003 app-store        —— 切换/刷新仓库 section 时处理 Commits
#   0004 styles           —— 样式索引引入 commits-filter
#   0005 menu-shortcut    —— ⌘3 "Show Commits" 菜单与快捷键
# 兼容 macOS 自带 bash 3.2（不使用关联数组）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/workspace"
PATCHES="$ROOT/patches"

group_files() {
  case "$1" in
    0001-add-commits-to-repository-section-tab)
      echo "app/src/lib/app-state.ts" ;;
    0002-register-commits-tab-in-repository-view)
      echo "app/src/ui/repository.tsx" ;;
    0003-handle-commits-section-in-app-store)
      echo "app/src/lib/stores/app-store.ts" ;;
    0004-import-commits-filter-styles)
      echo "app/styles/ui/_history.scss" ;;
    0005-add-show-commits-menu-and-shortcut)
      echo "app/src/models/menu-ids.ts app/src/main-process/menu/menu-event.ts app/src/main-process/menu/build-default-menu.ts app/src/ui/app.tsx app/src/lib/menu-update.ts" ;;
    0006-rebrand-app-for-coexistence)
      echo "app/package.json" ;;
    *) return 1 ;;
  esac
}

cd "$WS"
git add -A

if git diff --cached --quiet; then
  echo "[export-patches] workspace 与 baseline 一致，无胶水改动可导出"
  exit 0
fi

mkdir -p "$PATCHES"
rm -f "$PATCHES"/*.patch
: > "$PATCHES/series.txt"

for name in 0001-add-commits-to-repository-section-tab \
            0002-register-commits-tab-in-repository-view \
            0003-handle-commits-section-in-app-store \
            0004-import-commits-filter-styles \
            0005-add-show-commits-menu-and-shortcut \
            0006-rebrand-app-for-coexistence; do
  files="$(group_files "$name")"
  if git diff --cached --quiet -- $files; then
    echo "[export-patches] 跳过 $name（该组无改动）"
    continue
  fi
  git diff --cached -- $files > "$PATCHES/$name.patch"
  echo "$name.patch" >> "$PATCHES/series.txt"
  echo "[export-patches] 导出 $name.patch"
done

# 统计补丁体量（+/- 行，排除文件头）作为「最小侵入」验收指标
total=$(cat "$PATCHES"/*.patch 2>/dev/null | grep -E '^[+-]' | grep -cvE '^(\+\+\+|---)')
echo "[export-patches] 补丁净改动行数（+/-，不含头）: $total"
