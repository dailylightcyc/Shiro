// reverse proxy to github api
//

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  readGitHubSnapshot,
  saveGitHubSnapshot,
} from '~/lib/github-cache.server'

export const revalidate = 300
const publicProfilePath =
  /^users\/[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?(?:\/repos)?$/i
export const GET = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname.split('/').slice(3)
  const query = req.nextUrl.searchParams

  query.delete('all')

  const searchString = query.toString()

  const url = `https://api.github.com/${pathname.join('/')}${
    searchString ? `?${searchString}` : ''
  }`

  const headers = new Headers()
  const mayCache = publicProfilePath.test(pathname.join('/'))
  const cachedResponse = async () => {
    const snapshot = mayCache ? await readGitHubSnapshot(url) : null
    return snapshot
      ? NextResponse.json(snapshot.data, {
          headers: {
            'X-Shiro-GitHub-Cache': 'stale',
            'X-Shiro-GitHub-Cached-At': snapshot.savedAt,
            'Cache-Control': 'no-store',
          },
        })
      : null
  }
  headers.set('User-Agent', 'Shiro/MX-CMS')
  headers.set('Accept', 'application/vnd.github+json')
  // Only public profile/repository listings may use the server's rate-limit token.
  // Other proxy paths must never reveal resources accessible only to that token.
  if (process.env.GH_TOKEN && mayCache) {
    headers.set('Authorization', `Bearer ${process.env.GH_TOKEN}`)
  }

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate },
      signal: AbortSignal.timeout(12000),
    })
    const data = await response.json()
    if (response.ok && mayCache) await saveGitHubSnapshot(url, data)
    if ([403, 429, 500, 502, 503, 504].includes(response.status)) {
      const cached = await cachedResponse()
      if (cached) return cached
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    const cached = await cachedResponse()
    if (cached) return cached
    return NextResponse.json(
      { message: '暂时无法连接 GitHub，请稍后重试' },
      { status: 502 },
    )
  }
}
