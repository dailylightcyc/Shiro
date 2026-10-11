import { notFound } from 'next/navigation'

import type { Locale } from '~/i18n/config'
import { redirect } from '~/i18n/navigation'
import { apiClient } from '~/lib/request'
import { definePrerenderPage } from '~/lib/request.server'
import type { NoteWithTranslation } from '~/models/api'

export default definePrerenderPage<{ locale: Locale }>()({
  async fetcher() {
    const latest = await apiClient.note.proxy.latest.get<NoteWithTranslation>()

    return latest
  },
  Component: async ({ data: nullableData, params }) => {
    if (!nullableData || !nullableData.isPublished) {
      notFound()
    }
    const { locale } = params
    redirect({ href: `/notes/${nullableData.nid}`, locale })
    return null
  },
})
