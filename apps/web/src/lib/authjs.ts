import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { API_URL } from '~/constants/env'

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
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
