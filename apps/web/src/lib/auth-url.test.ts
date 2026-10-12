import { expect, it } from 'vitest'

import { resolveCmsAuthUrl } from './auth-url'

it('resolves the Docker same-origin API into an absolute authentication URL', () => {
  expect(resolveCmsAuthUrl('/api/v3', 'http://localhost:2323')).toBe(
    'http://localhost:2323/api/v3/auth',
  )
  expect(resolveCmsAuthUrl('/api/v3/', 'https://blog.example.com')).toBe(
    'https://blog.example.com/api/v3/auth',
  )
})

it('preserves an independent CMS origin and falls back to the same-origin API', () => {
  expect(
    resolveCmsAuthUrl('http://cms:2333/api/v3/', 'http://localhost:2323'),
  ).toBe('http://cms:2333/api/v3/auth')
  expect(resolveCmsAuthUrl('', 'https://blog.example.com')).toBe(
    'https://blog.example.com/api/v3/auth',
  )
})
