import { NextRequest } from 'next/server'
import { afterEach, expect, it, vi } from 'vitest'

import { readGitHubSnapshot } from '~/lib/github-cache.server'

import { GET } from './route'

vi.mock('~/lib/github-cache.server', () => ({
  readGitHubSnapshot: vi.fn().mockResolvedValue(null),
  saveGitHubSnapshot: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.mocked(readGitHubSnapshot).mockReset().mockResolvedValue(null)
})

it('keeps public projects available during upstream rate limits and marks the cached response', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: 'rate limited' }, { status: 403 }),
      ),
  )
  vi.mocked(readGitHubSnapshot).mockResolvedValue({
    url: 'https://api.github.com/users/dailylightcyc/repos',
    savedAt: '2026-10-12T04:00:00Z',
    data: [{ id: 1, name: 'Shiro' }],
  })
  const response = await GET(
    new NextRequest('http://localhost/api/gh/users/dailylightcyc/repos'),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('X-Shiro-GitHub-Cache')).toBe('stale')
  expect(await response.json()).toEqual([{ id: 1, name: 'Shiro' }])
})

it('loads public repositories without requiring a token', async () => {
  vi.stubEnv('GH_TOKEN', '')
  const fetch = vi.fn().mockResolvedValue(Response.json([{ id: 1 }]))
  vi.stubGlobal('fetch', fetch)
  const response = await GET(
    new NextRequest('http://localhost/api/gh/users/octocat/repos?per_page=100'),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([{ id: 1 }])
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull()
})

it('preserves GitHub errors and never forwards a token to arbitrary repository paths', async () => {
  vi.stubEnv('GH_TOKEN', 'test-token')
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ message: 'Not Found' }, { status: 404 }))
  vi.stubGlobal('fetch', fetch)
  const response = await GET(
    new NextRequest('http://localhost/api/gh/repos/org/private-project'),
  )
  expect(response.status).toBe(404)
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull()
})
