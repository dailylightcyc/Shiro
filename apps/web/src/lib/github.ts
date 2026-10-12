'use client'

const gitHubEndpoint = 'https://api.github.com'
const reverseProxy = '/api/gh'

export const fetchGitHubApi = async <T>(
  path: string,
  init?: RequestInit,
  onCached?: (savedAt: string) => void,
): Promise<T> => {
  const nextPath = path.replace(gitHubEndpoint, '')

  const response = await fetch(reverseProxy + nextPath, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'GitHub 请求失败，请稍后重试')
  }
  if (response.headers.get('X-Shiro-GitHub-Cache') === 'stale') {
    onCached?.(response.headers.get('X-Shiro-GitHub-Cached-At') || '')
  }
  return data as T
}
