import type {
  ArticleTranslation,
  NoteModel,
  NoteWrappedPayload,
  PostModel,
} from '@mx-space/api-client'

/** Presentation fields derived from the CMS response meta before serialization. */
export type ModelWithLiked<T> = T & { isLiked?: boolean }
export type ModelWithTranslation<T> = T & {
  isTranslated?: boolean
  sourceLang?: string
  availableTranslations?: string[]
  translationMeta?: Pick<
    ArticleTranslation,
    'sourceLang' | 'targetLang' | 'translatedAt' | 'model'
  >
  hasInsightsInLocale?: boolean
}

export type PostListItem = PostModel
export type NoteTopicListItem = NoteModel
export type NoteWithTranslation = ModelWithLiked<
  ModelWithTranslation<NoteWrappedPayload>
>
