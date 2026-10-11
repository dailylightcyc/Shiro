import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSiteAggregation } from './aggregation'

const cms = vi.hoisted(() => ({
  aggregate: { getAggregateData: vi.fn() },
  page: { getList: vi.fn() },
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
})
