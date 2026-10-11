import { isServer } from '@tanstack/react-query'

import { fetchSiteAggregation } from '~/lib/fetch/aggregation'

import { defineQuery } from '../helper'

export const aggregation = {
  root: () =>
    defineQuery({
      queryKey: ['aggregation'],
      queryFn: fetchSiteAggregation,
      gcTime: 1000 * 60 * 10,
      staleTime: isServer ? 1000 * 60 * 10 : undefined,
    }),
}
