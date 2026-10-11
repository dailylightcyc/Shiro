import type { IRequestAdapter } from '@mx-space/api-client'
import createClient, { allControllers } from '@mx-space/api-client'
import type { $fetch } from 'ofetch'

import { API_URL } from '~/constants/env'

import { adaptResponseData, transformCmsResponse } from './response'

type FetchType = typeof $fetch
export const createFetchAdapter = (
  $fetch: FetchType,
): IRequestAdapter<typeof $fetch> => ({
  default: $fetch,
  get(url: string, options) {
    const { params, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'GET',
      query: params,
    })
  },
  post(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'post',
      query: params,
      body: data,
    })
  },
  put(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'put',
      query: params,
      body: data,
    })
  },
  patch(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'patch',
      query: params,
      body: data,
    })
  },
  delete(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'delete',
      query: params,
      body: data,
    })
  },
})
export const createApiClient = (
  fetchAdapter: ReturnType<typeof createFetchAdapter>,
) =>
  createClient(fetchAdapter)(API_URL, {
    controllers: allControllers,
    transformResponse: transformCmsResponse,
    responseAdapter: {
      transformData(data, context) {
        return adaptResponseData(data, context.meta, context.path)
      },
    },
  })
