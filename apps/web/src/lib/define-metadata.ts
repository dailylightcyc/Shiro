import type { Metadata } from 'next'

// import { captureException } from '@sentry/nextjs'
import { getQueryClient } from '~/lib/query-client.server'
import { queries } from '~/queries/definition'

import { attachServerFetch } from './attach-fetch'
import type { SiteAggregation } from './fetch/aggregation'

export const defineMetadata = <T extends Record<string, string>>(
  fn: (
    params: T,
    getAggregationData: () => Promise<SiteAggregation>,
  ) => Promise<Partial<Metadata>>,
) => {
  const handler = async ({ params }: { params: T }): Promise<Metadata> => {
    const getData = async () => {
      const queryClient = getQueryClient()
      await attachServerFetch()
      return await queryClient.fetchQuery({
        ...queries.aggregation.root(),
      })
    }
    const result = await fn(params, getData).catch(() =>
      // captureException(err)
      ({}),
    )

    return {
      ...result,
    }
  }

  return handler
}
