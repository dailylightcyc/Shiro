#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for cmd in node corepack docker; do
  command -v "$cmd" >/dev/null || { echo "请先安装 $cmd。" >&2; exit 1; }
done
export COREPACK_HOME="${COREPACK_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/shiro-corepack}"
docker info >/dev/null 2>&1 || { echo '无法连接 Docker，请先启动 Docker 服务。' >&2; exit 1; }
node scripts/run-next.mjs stop
node scripts/prepare-stack.mjs development
corepack pnpm install --frozen-lockfile
if [[ "${SHIRO_SKIP_BUILD:-0}" != 1 ]]; then
  corepack pnpm --filter @shiro/web build
fi
SHIRO_LOCAL_IMAGE="$(node --env-file=.env.development.local -e 'process.stdout.write(process.env.SHIRO_IMAGE || "shiro:local")')"
node scripts/run-next.mjs deploy build --memory 512m --memory-swap 512m --tag "$SHIRO_LOCAL_IMAGE" .
docker compose --project-name shiro-dev --env-file .env.development.local \
  -f compose.stack.yml --profile production up -d --no-build --wait --wait-timeout 180
echo '站点：http://localhost:2323；CMS 登录：http://localhost:2323/login；GitHub 绑定：http://localhost:2323/dashboard'
echo '当前运行的是生产产物，复用现有 CMS 和数据库。修改源码后重新执行此脚本更新。'
