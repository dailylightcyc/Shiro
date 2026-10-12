import type { Project } from '~/components/modules/project/ProjectList'

import { fetchGitHubApi } from './github'

const usernamePattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
const trailingSlashes = /\/+$/

export function normalizeGitHubUsername(input: string) {
  let username = input.trim()
  if (!username) return ''
  if (/^https?:\/\//i.test(username)) {
    const url = new URL(username)
    if (!['github.com', 'www.github.com'].includes(url.hostname)) {
      throw new Error('请输入 GitHub 用户名或 GitHub 个人主页地址')
    }
    username = url.pathname.replace(/^\//, '').replace(trailingSlashes, '')
  }
  if (!usernamePattern.test(username) || username.includes('--')) {
    throw new Error('GitHub 用户名格式不正确')
  }
  return username
}

export type GitHubOwner = {
  social_ids?: Record<string, unknown>
  socialIds?: Record<string, unknown>
}

export async function saveGitHubBinding(
  input: string,
  request: (path: string, method?: string, data?: unknown) => Promise<unknown>,
) {
  const login = normalizeGitHubUsername(input)
  // Saving a public project source must remain available during GitHub rate limits.
  // Read the latest owner profile to preserve other social accounts.
  const owner = (await request('/owner')) as GitHubOwner
  await request('/owner', 'PATCH', {
    socialIds: { ...(owner.socialIds ?? owner.social_ids), github: login },
  })
  return login
}

export interface GitHubRepository {
  id: number
  name: string
  html_url: string
  description: string | null
  private: boolean
  disabled?: boolean
  owner: { avatar_url: string }
}

export async function fetchGitHubProjects(
  username: string,
  onCached?: (savedAt: string) => void,
) {
  const login = normalizeGitHubUsername(username)
  if (!login) return []
  const repositories: GitHubRepository[] = []
  for (let page = 1; ; page++) {
    const batch = await fetchGitHubApi<GitHubRepository[]>(
      `/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed&direction=desc&page=${page}`,
      undefined,
      onCached,
    )
    if (!Array.isArray(batch)) throw new Error('GitHub 仓库数据格式不正确')
    repositories.push(...batch)
    if (batch.length < 100) break
  }
  return repositories
    .filter((repo) => !repo.private && !repo.disabled)
    .map((repo): Project => ({
      id: `github:${repo.id}`,
      name: repo.name,
      description: repo.description,
      avatar: repo.owner.avatar_url,
      projectUrl: repo.html_url,
    }))
}

export function mergeProjects(
  cmsProjects: Project[],
  githubProjects: Project[],
) {
  const knownUrls = new Set(
    cmsProjects.map((project) =>
      project.projectUrl?.replace(trailingSlashes, '').toLowerCase(),
    ),
  )
  return [
    ...cmsProjects,
    ...githubProjects.filter(
      (project) =>
        !knownUrls.has(
          project.projectUrl?.replace(trailingSlashes, '').toLowerCase(),
        ),
    ),
  ]
}
