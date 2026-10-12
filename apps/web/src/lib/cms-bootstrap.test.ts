import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchCmsInitialization,
  readInitializationResponse,
  resolvePublicCmsUrls,
} from './cms-bootstrap'

describe('cMS deployment bootstrap', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('recognizes an initialized CMS after a restart removes InitModule', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'owner-id' } }))
    vi.stubGlobal('fetch', request)
    await expect(fetchCmsInitialization('http://cms/api/v3')).resolves.toBe(
      true,
    )
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'http://cms/api/v3/init',
      'http://cms/api/v3/owner',
    ])
  })
  it('rejects an incorrect API prefix when both routes are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({}, { status: 404 })),
    )
    await expect(fetchCmsInitialization('http://cms/wrong')).rejects.toThrow()
  })
  it('rejects a missing or incompatible public owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 404 }))
        .mockResolvedValueOnce(Response.json({ data: {} })),
    )
    await expect(fetchCmsInitialization('http://cms/api/v3')).rejects.toThrow()
  })
  it('keeps a fresh CMS in setup without requesting an owner', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { is_init: false } }))
    vi.stubGlobal('fetch', request)
    await expect(fetchCmsInitialization('http://cms/api/v3')).resolves.toBe(
      false,
    )
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('reads the native v3 initialization envelope', () => {
    expect(readInitializationResponse(200, { data: { is_init: false } })).toBe(
      false,
    )
    expect(readInitializationResponse(200, { data: { is_init: true } })).toBe(
      true,
    )
  })
  it('recognizes the init guard after the owner is created', () => {
    expect(
      readInitializationResponse(403, {
        error: { message: 'Forbidden resource' },
      }),
    ).toBe(true)
    expect(() =>
      readInitializationResponse(403, {
        error: { message: 'Crawlers are not allowed' },
      }),
    ).toThrow()
  })
  it('keeps incorrect URLs and outages distinct from an initialized CMS', () => {
    expect(() => readInitializationResponse(404, {})).toThrow()
    expect(() => readInitializationResponse(500, {})).toThrow()
    expect(() => readInitializationResponse(200, { data: {} })).toThrow()
  })
  it('uses the public gateway for a same-origin server deployment', () => {
    expect(resolvePublicCmsUrls('/api/v3', 'https://blog.example')).toEqual({
      webUrl: 'https://blog.example',
      serverUrl: 'https://blog.example/api/v3',
      adminUrl: 'https://blog.example/proxy/qaqdmin',
      wsUrl: 'https://blog.example',
    })
  })
  it('uses the CMS origin for development on separate ports', () => {
    expect(
      resolvePublicCmsUrls(
        'http://localhost:2333/api/v3',
        'http://localhost:2323',
      ).adminUrl,
    ).toBe('http://localhost:2333/proxy/qaqdmin')
  })
})
