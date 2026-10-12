import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

type Snapshot = { url: string; savedAt: string; data: unknown }

function cachePath(url: string) {
  const key = createHash('sha256').update(url).digest('hex')
  return resolve(
    process.env.SHIRO_GITHUB_CACHE_DIR || '.runtime/github',
    `${key}.json`,
  )
}

export async function readGitHubSnapshot(
  url: string,
): Promise<Snapshot | null> {
  try {
    const snapshot = JSON.parse(
      await readFile(cachePath(url), 'utf8'),
    ) as Snapshot
    return snapshot.url === url && typeof snapshot.savedAt === 'string'
      ? snapshot
      : null
  } catch {
    return null
  }
}

export async function saveGitHubSnapshot(url: string, data: unknown) {
  const path = cachePath(url)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(
      temporary,
      JSON.stringify({ url, savedAt: new Date().toISOString(), data }),
    )
    await rename(temporary, path)
  } catch {
    await rm(temporary, { force: true }).catch(() => {})
  }
}
