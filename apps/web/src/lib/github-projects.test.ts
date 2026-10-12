import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchGitHubProjects,
  mergeProjects,
  normalizeGitHubUsername,
  saveGitHubBinding,
} from './github-projects'

afterEach(() => vi.unstubAllGlobals())

const repository = (id: number) => ({
  id,
  name: `repo-${id}`,
  html_url: `https://github.com/octocat/repo-${id}`,
  description: 'A public project',
  private: false,
  owner: { avatar_url: 'https://avatars.githubusercontent.com/u/1' },
})

describe('gitHub project synchronization', () => {
  it('accepts usernames and profile URLs, and rejects repository URLs and other sites', () => {
    expect(normalizeGitHubUsername(' octocat ')).toBe('octocat')
    expect(normalizeGitHubUsername('https://github.com/octocat/')).toBe(
      'octocat',
    )
    expect(normalizeGitHubUsername('')).toBe('')
    for (const input of [
      'https://example.com/octocat',
      'https://github.com/octocat/repo',
      '-invalid',
      'invalid--name',
    ]) {
      expect(() => normalizeGitHubUsername(input)).toThrow()
    }
  })

  it('loads subsequent pages and excludes private and disabled repositories', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          Array.from({ length: 100 }, (_, index) => repository(index)),
        ),
      )
      .mockResolvedValueOnce(
        Response.json([
          repository(100),
          { ...repository(101), private: true },
          { ...repository(102), disabled: true },
        ]),
      )
    vi.stubGlobal('fetch', fetch)
    const projects = await fetchGitHubProjects('octocat')
    expect(projects).toHaveLength(101)
    expect(projects.at(-1)?.projectUrl).toBe(
      'https://github.com/octocat/repo-100',
    )
    expect(fetch.mock.calls[1][0]).toContain('page=2')
  })

  it('reports upstream failures instead of treating an error response as a repository list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: 'API rate limit exceeded' },
            { status: 403 },
          ),
        ),
    )
    await expect(fetchGitHubProjects('octocat')).rejects.toThrow(
      'API rate limit exceeded',
    )
  })

  it('keeps CMS edits and avoids listing an imported repository twice', () => {
    const cms = [
      {
        id: '123',
        name: 'Curated title',
        projectUrl: 'https://github.com/Octocat/Repo-1/',
      },
    ]
    const github = [
      {
        id: 'github:1',
        name: 'repo-1',
        projectUrl: 'https://github.com/octocat/repo-1',
      },
      {
        id: 'github:2',
        name: 'repo-2',
        projectUrl: 'https://github.com/octocat/repo-2',
      },
    ]
    expect(mergeProjects(cms, github)).toEqual([cms[0], github[1]])
  })

  it('saves the project source without depending on GitHub availability and preserves other accounts', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ social_ids: { twitter: 'owner', github: 'old' } })
    expect(
      await saveGitHubBinding('https://github.com/dailylightcyc', request),
    ).toBe('dailylightcyc')
    expect(request).toHaveBeenLastCalledWith('/owner', 'PATCH', {
      socialIds: { twitter: 'owner', github: 'dailylightcyc' },
    })
  })

  it('supports unbinding and rejects invalid input before changing the owner profile', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ socialIds: { gitlab: 'owner' } })
    await saveGitHubBinding('', request)
    expect(request).toHaveBeenLastCalledWith('/owner', 'PATCH', {
      socialIds: { gitlab: 'owner', github: '' },
    })
    request.mockClear()
    await expect(saveGitHubBinding('-invalid', request)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
