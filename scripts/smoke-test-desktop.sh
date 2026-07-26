#!/usr/bin/env bash
# smoke-test-desktop.sh — 冒烟验证：检查桌面端构建产物是否齐全
# 约束：只做检查，不做修改；不依赖 node/pnpm/file/ls/grep 之外的外部工具

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 待检查的文件列表
CHECKS=(
  "apps/review-shell/dist/src/main.js|Electron 主进程入口"
  "apps/review-shell/renderer/index.html|渲染器入口 HTML"
  "packages/review-engine/dist/src/index.js|审查引擎入口"
  "apps/review-shell/dist/src/preload.cjs|Preload 脚本"
)

failed=0

for entry in "${CHECKS[@]}"; do
  file="${entry%%|*}"
  label="${entry##*|}"
  path="${REPO_ROOT}/${file}"

  if [ -f "$path" ]; then
    echo "[PASS] $label ($file)"
  else
    echo "[FAIL] $label ($file) — 文件不存在"
    failed=1
  fi
done

if [ "$failed" -eq 0 ]; then
  echo ""
  echo "所有构建产物检查通过。"
  exit 0
else
  echo ""
  echo "存在缺失的构建产物，请先运行 pnpm build:desktop。"
  exit 1
fi
