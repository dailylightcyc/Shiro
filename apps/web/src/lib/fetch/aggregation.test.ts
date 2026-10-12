import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSiteAggregation } from './aggregation'

const cms = vi.hoisted(() => ({
  aggregate: { getAggregateData: vi.fn(), getSiteMetadata: vi.fn() },
  page: { getList: vi.fn() },
  note: { getList: vi.fn() },
  owner: { getOwnerInfo: vi.fn() },
  snippet: { getByPath: vi.fn() },
}))
vi.mock('~/lib/request', () => ({ apiClient: cms }))

describe('site navigation aggregation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cms.aggregate.getAggregateData.mockResolvedValue({
      $serialized: {
        user: { id: '9007199254740993123' },
        theme: { config: {} },
      },
    })
  })

  it('loads every CMS page in order, including pages beyond the first batch', async () => {
    cms.page.getList
      .mockResolvedValueOnce({
        data: [{ id: '9007199254740993124', slug: 'about', order: 1 }],
        pagination: { page: 1, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: '9007199254740993125', slug: 'equipment', order: 2 }],
        pagination: { page: 2, totalPages: 2 },
      })
    const result = await fetchSiteAggregation()
    expect(result.pageMeta.map((page) => page.slug)).toEqual([
      'about',
      'equipment',
    ])
    expect(result.user.id).toBe('9007199254740993123')
    expect(result.theme).toEqual({ config: {} })
    expect(cms.page.getList.mock.calls).toEqual([
      [1, 50],
      [2, 50],
    ])
  })

  it('supports sites without custom pages', async () => {
    cms.page.getList.mockResolvedValue({
      data: [],
      pagination: { page: 1, totalPages: 0 },
    })
    expect((await fetchSiteAggregation()).pageMeta).toEqual([])
    expect(cms.page.getList).toHaveBeenCalledTimes(1)
  })

  it('renders a newly initialized Core site before its first public note', async () => {
    cms.aggregate.getAggregateData.mockRejectedValue({ status: 404 })
    cms.note.getList.mockResolvedValue({ data: [] })
    cms.aggregate.getSiteMetadata.mockResolvedValue({
      $serialized: {
        seo: { title: 'New site' },
        url: { webUrl: 'http://site.test' },
      },
      url: { webUrl: 'http://site.test' },
    })
    cms.owner.getOwnerInfo.mockResolvedValue({
      $serialized: { id: '1', name: 'Owner' },
    })
    cms.snippet.getByPath.mockRejectedValue({ status: 404 })
    cms.page.getList.mockResolvedValue({
      data: [],
      pagination: { totalPages: 0 },
    })
    const result = await fetchSiteAggregation()
    expect(result.user.name).toBe('Owner')
    expect(result.seo.title).toBe('New site')
    expect(result.latestNoteId).toBeNull()
    expect(result.theme).toBeUndefined()
  })

  it('preserves upstream errors when public notes already exist', async () => {
    const error = { status: 404 }
    cms.aggregate.getAggregateData.mockRejectedValue(error)
    cms.note.getList.mockResolvedValue({ data: [{ id: '1' }] })
    cms.page.getList.mockResolvedValue({
      data: [],
      pagination: { totalPages: 0 },
    })
    await expect(fetchSiteAggregation()).rejects.toBe(error)
    expect(cms.aggregate.getSiteMetadata).not.toHaveBeenCalled()
  })

  it('does not conceal CMS connection or authentication failures', async () => {
    const error = { status: 403 }
    cms.aggregate.getAggregateData.mockRejectedValue(error)
    cms.page.getList.mockResolvedValue({
      data: [],
      pagination: { totalPages: 0 },
    })
    await expect(fetchSiteAggregation()).rejects.toBe(error)
    expect(cms.note.getList).not.toHaveBeenCalled()
  })
})
