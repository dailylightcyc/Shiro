import { getGlobalStore } from 'jojoo'
import type { createStore } from 'jotai/vanilla'

type Store = ReturnType<typeof createStore>

export const jotaiStore: Store = getGlobalStore()
