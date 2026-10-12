'use client'

import { atom, useAtomValue } from 'jotai'
import type { FC, PropsWithChildren } from 'react'
import { createContext, useContext, useEffect } from 'react'

import { setWebUrl } from '~/atoms'
import { isDev } from '~/lib/env'
import type { SiteAggregation as AggregateRoot } from '~/lib/fetch/aggregation'
import { jotaiStore } from '~/lib/store'

export type { AggregateRoot }

export const aggregationDataAtom = atom<null | AggregateRoot>(null)
const appConfigAtom = atom<AppConfig | null>(null)
const AggregationContext = createContext<AggregateRoot | null>(null)
const AppConfigContext = createContext<AppConfig | null>(null)

export const AggregationProvider: FC<
  PropsWithChildren<{
    aggregationData: AggregateRoot
    appConfig: AppConfig
  }>
> = ({ children, aggregationData, appConfig }) => {
  useEffect(() => {
    if (!appConfig) return
    jotaiStore.set(appConfigAtom, appConfig)
  }, [appConfig])

  useEffect(() => {
    if (!aggregationData) return
    jotaiStore.set(aggregationDataAtom, aggregationData)
    setWebUrl(aggregationData.url.webUrl)
  }, [aggregationData])

  return (
    <AggregationContext value={aggregationData}>
      <AppConfigContext value={appConfig}>{children}</AppConfigContext>
    </AggregationContext>
  )
}

export const useAggregationSelector = <T,>(
  selector: (atomValue: AggregateRoot) => T,
  _deps: any[] = [],
): T | null => {
  const snapshot = useContext(AggregationContext)
  const fallback = useAtomValue(aggregationDataAtom, { store: jotaiStore })
  const data = snapshot ?? fallback
  return data ? selector(data) : null
}

export const useAppConfigSelector = <T,>(
  selector: (atomValue: AppConfig) => T,
  _deps: any[] = [],
): T | null => {
  const snapshot = useContext(AppConfigContext)
  const fallback = useAtomValue(appConfigAtom, { store: jotaiStore })
  const config = snapshot ?? fallback
  return config ? noThrowFnWrapper(selector)(config) : null
}

export const getAggregationData = () => jotaiStore.get(aggregationDataAtom)

export const getAppConfig = () => jotaiStore.get(appConfigAtom)

const noThrowFnWrapper = <T extends (...args: any[]) => any>(fn: T): T => {
  return ((...args: any[]) => {
    try {
      return fn(...args)
    } catch (e: any) {
      if (isDev) {
        console.error(e)
      }
      return null
    }
  }) as T
}
