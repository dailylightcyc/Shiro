const trailingSlash = /\/+$/

export function resolveCmsAuthUrl(apiUrl: string, origin: string) {
  const url = new URL(apiUrl || '/api/v3', origin)
  url.pathname = `${url.pathname.replace(trailingSlash, '')}/auth`
  url.search = ''
  url.hash = ''
  return url.href
}
