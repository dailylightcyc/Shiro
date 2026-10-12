const trailingSlash = /\/$/

export async function fetchCmsInitialization(apiUrl: string, timeoutMs = 5000) {
  const request = (path: string) =>
    fetch(`${apiUrl.replace(trailingSlash, '')}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  const response = await request('/init')
  const body = await response.json().catch(() => null)
  // Core omits InitModule when it boots with an existing owner. Confirm the
  // public owner rather than mistaking any missing API route for initialization.
  if (response.status === 404) {
    const ownerResponse = await request('/owner')
    const envelope = await ownerResponse.json().catch(() => null)
    const owner = envelope?.data ?? envelope
    if (ownerResponse.ok && typeof owner?.id === 'string' && owner.id)
      {return true}
    throw new Error('无法确认 CMS 初始化状态，请检查 API 地址')
  }
  return readInitializationResponse(response.status, body)
}

export function readInitializationResponse(status: number, body: unknown) {
  // InitGuard closes all /init routes after the owner has been created.
  if (status === 403) {
    const error = (body as { error?: { message?: string } } | null)?.error
    if (error?.message === 'Forbidden resource') return true
    throw new Error(error?.message || 'CMS 拒绝访问初始化接口')
  }
  if (status !== 200) throw new Error('无法读取 CMS 初始化状态')
  const envelope = body as { data?: unknown } | null
  const data = (envelope?.data ?? body) as {
    is_init?: boolean
    isInit?: boolean
  } | null
  const initialized = data?.is_init ?? data?.isInit
  if (typeof initialized !== 'boolean') {
    throw new TypeError('CMS 初始化接口返回了不兼容的数据，请检查 API 地址')
  }
  return initialized
}

export function resolvePublicCmsUrls(apiUrl: string, webUrl: string) {
  const api = new URL(apiUrl, webUrl)
  return {
    webUrl,
    serverUrl: api.href.replace(trailingSlash, ''),
    adminUrl: `${api.origin}/proxy/qaqdmin`,
    wsUrl: api.origin,
  }
}
