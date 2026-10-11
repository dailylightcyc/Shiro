import { apiClient } from '~/lib/request'
import type { NoteWithTranslation } from '~/models/api'

import { defineQuery } from '../helper'

const LATEST_KEY = 'latest'
export const note = {
  byNid: (nid: string, password?: string | null, lang?: string) =>
    defineQuery({
      queryKey: ['note', nid, lang, password],

      queryFn: async ({ queryKey }) => {
        const [, id, lang, password] = queryKey as [
          string,
          string,
          string | undefined,
          string | null | undefined,
        ]

        if (id === LATEST_KEY) {
          const data =
            await apiClient.note.proxy.latest.get<NoteWithTranslation>({
              params: {
                password: password || undefined,
                lang,
                prefer: 'lexical',
              },
            })
          return data.$serialized
        }
        const data = await apiClient.note.getNoteByNid(Number(id), {
          password: password || undefined,
          lang: lang || undefined,
          prefer: 'lexical',
        })

        return data.$serialized as NoteWithTranslation
      },
    }),
}
