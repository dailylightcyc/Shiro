#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for cmd in node corepack docker; do
  command -v "$cmd" >/dev/null || { echo "请先安装 $cmd。" >&2; exit 1; }
done
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<12)) throw new Error("需要 Node.js >=22.12")'
export COREPACK_HOME="${COREPACK_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/shiro-corepack}"
export SHARP_IGNORE_GLOBAL_LIBVIPS=1
docker info >/dev/null 2>&1 || { echo '无法连接 Docker，请先启动 Docker 服务。Linux 可执行 sudo systemctl start docker。' >&2; exit 1; }
node scripts/prepare-stack.mjs development
STACK_ENV="$PWD/.env.development.local"
compose=(docker compose --project-name shiro-dev --env-file "$STACK_ENV" -f compose.stack.yml)
"${compose[@]}" --profile production stop gateway shiro
"${compose[@]}" up -d --wait --wait-timeout 180 cms
read_env() { node --env-file="$STACK_ENV" -e 'process.stdout.write(process.env[process.argv[1]] || "")' "$1"; }
WEB_PORT="$(read_env WEB_PORT)"
CMS_PORT="$(read_env CMS_PORT)"
export NEXT_PUBLIC_API_URL="http://localhost:${CMS_PORT}/api/v3"
export NEXT_PUBLIC_CLIENT_API_URL="$NEXT_PUBLIC_API_URL"
export NEXT_PUBLIC_GATEWAY_URL="http://localhost:${CMS_PORT}"
export NEXT_PUBLIC_CMS_ADMIN_URL="http://localhost:${CMS_PORT}/proxy/qaqdmin"
corepack pnpm install --frozen-lockfile
echo "前端 / 初始化：http://localhost:${WEB_PORT}"
echo "CMS 管理后台：${NEXT_PUBLIC_CMS_ADMIN_URL}"
echo '首次访问填写引导页创建管理员。Ctrl+C 停止前端；Docker 数据库与 CMS 继续运行。'
export WEB_PORT
exec node scripts/run-next.mjs dev
