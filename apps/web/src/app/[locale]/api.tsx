import { defaultThemeConfig } from '~/app.default.theme-config'
import { appStaticConfig } from '~/app.static.config'
import { attachServerFetch } from '~/lib/attach-fetch'
import { fetchSiteAggregation } from '~/lib/fetch/aggregation'
import { deepMerge } from '~/lib/lodash'
import { getQueryClient } from '~/lib/query-client.server'

const cacheTime = appStaticConfig.cache.enabled
  ? appStaticConfig.cache.ttl.aggregation
  : 1
export const fetchAggregationData = async () => {
  await attachServerFetch()
  const queryClient = getQueryClient()
  const fetcher = async () => {
    const data = await fetchSiteAggregation()

    return {
      ...data,
      theme: data.theme
        ? deepMerge(defaultThemeConfig, data.theme)
        : defaultThemeConfig,
    }
  }

  return queryClient.fetchQuery({
    queryKey: ['aggregate', 'shiro'],
    queryFn: fetcher,
    staleTime: cacheTime,
    gcTime: cacheTime,
  })
}
