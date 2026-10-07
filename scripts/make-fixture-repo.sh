#!/usr/bin/env bash
# 生成确定性本地测试仓库：4 位作者、跨 5 个月、部分提交带多行描述(正文)。
# 用法: ./scripts/make-fixture-repo.sh [目标目录，默认 scripts/fixtures/demo-repo]
set -euo pipefail
DEST="${1:-$(cd "$(dirname "$0")" && pwd)/fixtures/demo-repo}"

rm -rf "$DEST"
mkdir -p "$DEST"
cd "$DEST"
git init -q -b main

commit() { # commit <name> <email> <date-iso> <summary> <body-or-empty>
  local name="$1" email="$2" date="$3" summary="$4" body="${5:-}"
  export GIT_AUTHOR_NAME="$name" GIT_AUTHOR_EMAIL="$email" GIT_AUTHOR_DATE="$date"
  export GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$email" GIT_COMMITTER_DATE="$date"
  if [ -n "$body" ]; then
    printf '%s\n\n%s\n' "$summary" "$body" | git commit -q --file=-
  else
    git commit -q -m "$summary"
  fi
}

# ---- 初始提交 + README ----
echo "# demo-repo" > README.md
git add README.md
commit "Yoko Tanaka" "yoko@example.com" "2026-06-01T09:00:00 +09:00" "Initial commit" "Set up the project skeleton with a README."

# ---- 6 月：Yoko 为主 ----
for i in 1 2 3 4 5; do
  echo "line $i" >> README.md
  git add README.md
  commit "Yoko Tanaka" "yoko@example.com" "2026-06-1${i}T10:0${i}:00 +09:00" \
    "Update README: add line $i" ""
done

# ---- 7 月：Alex Chen ----
mkdir -p src
cat > src/app.js <<'EOF'
console.log("demo app");
EOF
git add src
commit "Alex Chen" "alex@example.com" "2026-07-02T14:00:00 +08:00" \
  "Add Node.js application entry point" \
  "Create src/app.js with a minimal console bootstrap so the project can be executed with node."
for i in 1 2 3 4; do
  echo "// feature $i" >> src/app.js
  git add src
  commit "Alex Chen" "alex@example.com" "2026-07-1${i}T15:3${i}:00 +08:00" \
    "Extend application with feature $i" ""
done

# ---- 8 月：Maria García（含多行正文，测试描述搜索）----
mkdir -p docs
cat > docs/notes.md <<'EOF'
# Notes
Refactor log: renaming modules for clarity.
EOF
git add docs
commit "Maria García" "maria@example.com" "2026-08-05T11:00:00 +02:00" \
  "Add internal refactor notes" \
  "The refactor plan renames utils into small focused modules.
This improves the parsing performance for large documents."
for i in 1 2 3; do
  echo "note $i" >> docs/notes.md
  git add docs
  commit "Maria García" "maria@example.com" "2026-08-1${i}T12:1${i}:00 +02:00" \
    "Update notes $i" ""
done
git mv README.md README2.md
commit "Maria García" "maria@example.com" "2026-08-28T09:00:00 +02:00" \
  "Rename README for clarity" \
  "README2 signals that more documentation files are coming."
echo "body" >> README2.md; git add README2.md
commit "Maria García" "maria@example.com" "2026-08-30T09:30:00 +02:00" \
  "Polish documentation wording" \
  "Clarify the installation steps and mention the dependency on Python 3."

# ---- 9 月：David Kim ----
mkdir -p tests
cat > tests/app.test.js <<'EOF'
test("demo", () => expect(true).toBe(true));
EOF
git add tests
commit "David Kim" "david@example.com" "2026-09-03T18:00:00 -07:00" \
  "Add first JavaScript unit test" \
  "Introduce a trivial test to validate the toolchain wiring end to end."
for i in 1 2 3 4 5; do
  echo "// test $i" >> tests/app.test.js
  git add tests
  commit "David Kim" "david@example.com" "2026-09-1${i}T19:2${i}:00 -07:00" \
    "Add regression test case $i" ""
done

# ---- 10 月：混合作者，含 bugfix / release 主题词 ----
echo "body2" >> README2.md; git add README2.md
commit "Yoko Tanaka" "yoko@example.com" "2026-10-01T10:00:00 +09:00" \
  "Fix pagination bug in history list" \
  "Scrolling to the bottom now loads the next batch exactly once."
echo "v1" > VERSION; git add VERSION
commit "Alex Chen" "alex@example.com" "2026-10-02T10:30:00 +08:00" \
  "Release v1.0.0" \
  "First stable release. Highlights: parser rewrite and faster startup."
git mv src/app.js src/main.js 2>/dev/null || { mkdir -p src && git mv src/app.js src/main.js; }
commit "David Kim" "david@example.com" "2026-10-03T08:00:00 -07:00" \
  "Refactor application entry point"
for i in 1 2 3 4 5 6 7 8; do
  echo "// polish $i" >> src/main.js
  git add src/main.js
  case $((i % 4)) in
    0) A="Yoko Tanaka"; E="yoko@example.com";;
    1) A="Alex Chen";  E="alex@example.com";;
    2) A="Maria García"; E="maria@example.com";;
    3) A="David Kim";  E="david@example.com";;
  esac
  commit "$A" "$E" "2026-10-0$((3+i))T09:$((10+i)):00 +00:00" \
    "Polish main module part $i" ""
done

# ---- 特性分支（验证筛选范围 = 当前分支）----
git checkout -qb feature/experiment
echo "experimental" > experiment.txt; git add experiment.txt
commit "Yoko Tanaka" "yoko@example.com" "2026-10-06T10:00:00 +09:00" \
  "Try an experimental parser" \
  "Prototype only, must not appear when main is selected."
git checkout -q main

# ---- 汇总 ----
echo "=== fixture ready: $DEST ==="
git -C "$DEST" log --format='%ad %an <%ae> %s' --date=short | head -40
echo "total commits: $(git -C "$DEST" rev-list --count main)"
