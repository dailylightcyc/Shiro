import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { API_URL } from '~/constants/env'

import { resolveCmsAuthUrl } from './auth-url'

export const authClient = createAuthClient({
  baseURL: resolveCmsAuthUrl(
    API_URL,
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:2323'
      : window.location.origin,
  ),
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: 'include',
  },
})

export type AuthSocialProviders =
  | 'apple'
  | 'discord'
  | 'facebook'
  | 'github'
  | 'google'
  | 'microsoft'
  | 'spotify'
  | 'twitch'
  | 'twitter'
  | 'dropbox'
  | 'linkedin'
  | 'gitlab'

export const getUserUrl = <
  T extends { handle?: string; provider: AuthSocialProviders },
>(
  user: T,
) => {
  if (!user.handle) return
  switch (user.provider) {
    case 'github': {
      return `https://github.com/${user.handle}`
    }
  }
}

const { useSession } = authClient
export { useSession }
