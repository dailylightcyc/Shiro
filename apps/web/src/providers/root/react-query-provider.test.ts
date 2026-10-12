import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  useQuery,
} from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it } from 'vitest'

import { queryClient, ReactQueryProvider } from './react-query-provider'

afterEach(() => queryClient.clear())

function Posts() {
  const { data } = useQuery<string[]>({ queryKey: ['home'], enabled: false })
  return createElement(
    'ul',
    null,
    data?.map((title) => createElement('li', { key: title }, title)),
  )
}

function renderRequest(posts: string[]) {
  const snapshot = new QueryClient()
  snapshot.setQueryData(['home'], posts)
  return renderToString(
    createElement(
      ReactQueryProvider,
      null,
      createElement(
        HydrationBoundary,
        { state: dehydrate(snapshot) },
        createElement(Posts),
      ),
    ),
  )
}

it('uses the request snapshot even when another render left newer data in the shared client', () => {
  queryClient.setQueryData(['home'], ['Previous request'], {
    updatedAt: Date.now() + 60000,
  })
  expect(renderRequest([])).toBe('<ul></ul>')
  expect(renderRequest(['New CMS post'])).toBe('<ul><li>New CMS post</li></ul>')
  expect(queryClient.getQueryData(['home'])).toEqual(['Previous request'])
})
