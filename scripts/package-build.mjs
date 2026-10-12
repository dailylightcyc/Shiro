import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const report = JSON.parse(
  readFileSync(resolve(root, '.runtime/build-result.json'), 'utf8'),
)
if (
  report.mode !== 'build' ||
  report.code !== 0 ||
  report.enforcement !== 'cgroup' ||
  report.budgetMiB !== 2048 ||
  report.peakScopeMiB > 2048 ||
  report.stages?.length !== 4 ||
  report.stages.some((stage) => stage.code !== 0 || stage.oomKilled)
) {
  throw new Error(
    'Only a complete, successful 2 GiB cgroup build can be packaged.',
  )
}
const web = resolve(root, 'apps/web')
for (const path of [
  '.next/BUILD_ID',
  '.next/required-server-files.json',
  '.next/standalone/apps/web/server.js',
]) {
  if (!existsSync(resolve(web, path))) throw new Error(`Missing ${path}`)
}
const routes = JSON.parse(
  readFileSync(resolve(web, '.next/server/app-paths-manifest.json'), 'utf8'),
)
for (const route of [
  '/(bootstrap)/setup/page',
  '/(bootstrap)/login/page',
  '/(bootstrap)/dashboard/page',
  '/[locale]/(home)/page',
  '/[locale]/projects/page',
]) {
  if (!routes[route]) throw new Error(`Missing route ${route}`)
}
mkdirSync(resolve(root, 'build'), { recursive: true })
const archive = 'build/shiro-standalone.tar.gz'
const tar = spawnSync(
  'tar',
  [
    '--exclude=.env',
    '--exclude=.env.*',
    '-czf',
    archive,
    'Dockerfile',
    '.dockerignore',
    'apps/web/.next/standalone',
    'apps/web/.next/static',
    'apps/web/public',
  ],
  { cwd: root, stdio: 'inherit' },
)
if (tar.error) throw tar.error
if (tar.status !== 0) throw new Error(`tar exited with ${tar.status}`)
const hash = createHash('sha256')
for await (const chunk of createReadStream(resolve(root, archive))) {
  hash.update(chunk)
}
const checksum = hash.digest('hex')
writeFileSync(
  resolve(root, `${archive}.sha256`),
  `${checksum}  shiro-standalone.tar.gz\n`,
)
console.log(
  `${archive}: ${report.peakScopeMiB} MiB peak; Docker only copies the compiled application.`,
)
