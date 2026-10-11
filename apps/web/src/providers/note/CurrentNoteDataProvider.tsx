'use client'

import { useQuery } from '@tanstack/react-query'
import { createModelDataProvider } from 'jojoo/react'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useEffect } from 'react'

import type { NoteWithTranslation } from '~/models/api'
import { queries } from '~/queries/definition'

const {
  ModelDataProvider,
  ModelDataAtomProvider,
  getGlobalModelData: getModelData,
  setGlobalModelData: setModelData,
  useModelDataSelector,
  useSetModelData,
} = createModelDataProvider<NoteWithTranslation>()

export {
  ModelDataAtomProvider as CurrentNoteDataAtomProvider,
  ModelDataProvider as CurrentNoteDataProvider,
  getModelData as getCurrentNoteData,
  setModelData as setCurrentNoteData,
  useModelDataSelector as useCurrentNoteDataSelector,
  useSetModelData as useSetCurrentNoteData,
}

export const SyncNoteDataAfterLoggedIn = () => {
  const nid = useModelDataSelector((data) => data?.nid)
  const password = useSearchParams().get('password')
  const locale = useLocale()
  const { data } = useQuery({
    ...queries.note.byNid(nid?.toString() || '', password, locale),
    enabled: !!nid,
  })

  useEffect(() => {
    if (data) {
      const noteData = data as NoteWithTranslation
      setModelData((draft) => {
        Object.assign(draft, noteData)
      })
    }
  }, [data])

  return null
}
