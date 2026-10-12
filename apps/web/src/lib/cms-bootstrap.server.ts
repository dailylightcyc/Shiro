import 'server-only'

import { cache } from 'react'

import { API_URL } from '~/constants/env'

import { fetchCmsInitialization } from './cms-bootstrap'

export const getCmsInitialization = cache(async () => {
  try {
    return {
      initialized: await fetchCmsInitialization(API_URL),
      error: null,
    }
  } catch (error) {
    return {
      initialized: false,
      error: error instanceof Error ? error.message : '无法连接 CMS',
    }
  }
})
