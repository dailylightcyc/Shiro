import { thumbHashToDataURL } from 'thumbhash'

export function thumbhashPlaceholder(hash?: string): string | undefined {
  if (!hash) return undefined
  try {
    const bytes = Uint8Array.from(atob(hash), (char) => char.charCodeAt(0))
    return thumbHashToDataURL(bytes)
  } catch {
    return undefined
  }
}
