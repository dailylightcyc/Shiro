#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for cmd in node corepack docker; do
  command -v "$cmd" >/dev/null || { echo "请先安装 $cmd。" >&2; exit 1; }
done
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<12)) throw new Error("需要 Node.js >=22.12")'
export COREPACK_HOME="${COREPACK_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/shiro-corepack}"
export SHARP_IGNORE_GLOBAL_LIBVIPS=1
docker info >/dev/null 2>&1 || { echo '无法连接 Docker，请先启动 Docker 服务。' >&2; exit 1; }
node scripts/prepare-stack.mjs production
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @shiro/web build
SHIRO_LOCAL_IMAGE="$(node --env-file=.env.production.local -e 'process.stdout.write(process.env.SHIRO_IMAGE || "shiro:local")')"
node scripts/run-next.mjs deploy build --memory 512m --memory-swap 512m --tag "$SHIRO_LOCAL_IMAGE" .
exec docker compose --project-name shiro-production --env-file .env.production.local \
  -f compose.stack.yml --profile production up -d --no-build --wait --wait-timeout 180
