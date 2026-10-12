import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode = process.argv[2] || 'development'
if (!['development', 'production'].includes(mode)) {
  throw new Error(
    'Usage: node scripts/prepare-stack.mjs [development|production]',
  )
}
const path = resolve(root, `.env.${mode}.local`)
if (!existsSync(path)) {
  writeFileSync(
    path,
    [
      'MX_CMS_IMAGE=innei/mx-server:14.15.2',
      'PG_USER=shiro',
      'PG_DATABASE=mx_core',
      `PG_PASSWORD=${randomBytes(24).toString('hex')}`,
      `JWT_SECRET=${randomBytes(32).toString('hex')}`,
      `ENCRYPT_KEY=${randomBytes(32).toString('hex')}`,
      'SNOWFLAKE_WORKER_ID=1',
      'CMS_BIND=127.0.0.1',
      'CMS_PORT=2333',
      'WEB_PORT=2323',
      'PUBLIC_WEB_URL=http://localhost:2323',
      'ALLOWED_ORIGINS=localhost:*,127.0.0.1:*',
      '',
    ].join('\n'),
    { mode: 0o600, flag: 'wx' },
  )
  console.log(`Created ${path}. Secrets stay in this local file.`)
} else {
  console.log(`Using ${path}. Existing credentials and volumes are preserved.`)
}
