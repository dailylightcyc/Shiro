import type { RequestError } from '@mx-space/api-client'

export const getErrorMessageFromRequestError = (error: RequestError) =>
  error.message
