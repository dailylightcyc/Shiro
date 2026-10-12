import type { AggregateRoot, PageModel } from '@mx-space/api-client'

import { API_URL, GATEWAY_URL } from '~/constants/env'
import { apiClient } from '~/lib/request'

export type SiteAggregation = Omit<AggregateRoot, 'latestNoteId'> & {
  latestNoteId: AggregateRoot['latestNoteId'] | null
  pageMeta: PageModel[]
  theme?: AppThemeConfig
}

function isNotFound(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 404
  )
}

async function getAggregate(): Promise<Omit<SiteAggregation, 'pageMeta'>> {
  try {
    return (await apiClient.aggregate.getAggregateData<AppThemeConfig>('shiro'))
      .$serialized
  } catch (error) {
    if (!isNotFound(error)) throw error
    // Core 14.15.2 returns 404 from /aggregate before the first public note.
    // Verify that condition before composing the public site endpoints.
    const notes = await apiClient.note.getList(1, 1)
    if (notes.data.length) throw error
    const [site, owner, theme] = await Promise.all([
      apiClient.aggregate.getSiteMetadata(),
      apiClient.owner.getOwnerInfo(),
      apiClient.snippet
        .getByPath<AppThemeConfig>('theme/shiro')
        .catch((snippetError: unknown) => {
          if (!isNotFound(snippetError)) throw snippetError
          return undefined
        }),
    ])
    return {
      ...site.$serialized,
      user: owner.$serialized,
      url: { ...site.url, serverUrl: API_URL, wsUrl: GATEWAY_URL },
      latestNoteId: null,
      theme: theme?.$serialized,
    }
  }
}

export async function fetchSiteAggregation(): Promise<SiteAggregation> {
  const [aggregate, firstPage] = await Promise.all([
    getAggregate(),
    apiClient.page.getList(1, 50),
  ])
  const pageMeta = [...firstPage.data]
  for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
    const result = await apiClient.page.getList(page, 50)
    pageMeta.push(...result.data)
  }
  return { ...aggregate, pageMeta }
}
