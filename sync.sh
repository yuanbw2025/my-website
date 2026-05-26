#!/bin/bash
# sync.sh — 从独立仓库拉取最新代码到主库
#
# 使用方式：
#   bash sync.sh              # 同步所有子项目
#   bash sync.sh storyforge   # 只同步指定项目
#
# 架构说明（2026-05-26 起）：
#   - 日常开发在各独立仓库进行（~/Desktop/projects/<项目名>/）
#   - 本脚本将独立仓库的最新代码拉取到主库对应子目录
#   - 拉取后 push 主库即可触发 Vercel 部署
#
# 注意：不要在主库直接修改子目录代码，否则 subtree pull 可能冲突

set -e

# 子项目映射：子目录名:remote名
PROJECTS=(
  "storyforge:storyforge-mirror"
  "yuntype:yuntype-mirror"
  "novel-game:novel-game-mirror"
  "ai-slides:ai-slides-mirror"
  "ai-presentation:ai-presentation-mirror"
)

# 如果传了参数，只同步指定项目
TARGET="$1"

synced=0

for entry in "${PROJECTS[@]}"; do
  prefix="${entry%%:*}"
  remote="${entry##*:}"

  # 如果指定了 TARGET，跳过不匹配的
  if [ -n "$TARGET" ] && [ "$prefix" != "$TARGET" ]; then
    continue
  fi

  echo "🔄 Syncing $prefix from $remote/main ..."
  git subtree pull --prefix="$prefix" "$remote" main --squash \
    -m "sync: pull latest $prefix"
  echo "✅ $prefix synced."
  echo ""
  synced=$((synced + 1))
done

if [ $synced -eq 0 ] && [ -n "$TARGET" ]; then
  echo "❌ Unknown project: $TARGET"
  echo "Available: ${PROJECTS[*]%%:*}"
  exit 1
fi

echo "🚀 Done! $synced project(s) synced."
echo "   Run 'git push origin main' to trigger Vercel deployment."
