import type { AggregateRoot, PageModel } from '@mx-space/api-client'

import { apiClient } from '~/lib/request'

export type SiteAggregation = AggregateRoot & {
  pageMeta: PageModel[]
  theme?: AppThemeConfig
}

export async function fetchSiteAggregation(): Promise<SiteAggregation> {
  const [aggregate, firstPage] = await Promise.all([
    apiClient.aggregate.getAggregateData<AppThemeConfig>('shiro'),
    apiClient.page.getList(1, 50),
  ])
  const pageMeta = [...firstPage.data]
  for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
    const result = await apiClient.page.getList(page, 50)
    pageMeta.push(...result.data)
  }
  return { ...aggregate.$serialized, pageMeta }
}
