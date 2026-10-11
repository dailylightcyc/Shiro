import type {
  ArticleTranslation,
  EntryTranslation,
  InteractionMeta,
  ReaderModel,
  ResponseMeta,
} from '@mx-space/api-client'
import { simpleCamelcaseKeys } from '@mx-space/api-client'

const isRecord = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** CMS metadata and theme JSON are user-defined, while dictionary keys are identities. */
export function transformCmsResponse<T>(data: T): T {
  if (Array.isArray(data)) return data.map(transformCmsResponse) as T
  if (!isRecord(data)) return data
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      const nextKey = Object.keys(
        simpleCamelcaseKeys(
          { [key]: null },
          {
            shouldSkipKey: (key) => /^https?:\/\//.test(key),
          },
        ),
      )[0]
      if (key === 'meta' || key === 'theme') return [nextKey, value]
      if ((key === 'presence' || key === 'readers') && isRecord(value)) {
        return [
          nextKey,
          Object.fromEntries(
            Object.entries(value).map(([id, entry]) => [
              id,
              transformCmsResponse(entry),
            ]),
          ),
        ]
      }
      return [nextKey, transformCmsResponse(value)]
    }),
  ) as T
}

function entryFor<T extends object>(
  value: T | Record<string, T> | undefined,
  id: string,
  keys: string[],
): T | undefined {
  if (!value) return undefined
  return keys.some((key) => key in value)
    ? (value as T)
    : (value as Record<string, T>)[id]
}

function articleView(item: unknown, meta?: ResponseMeta): unknown {
  if (!isRecord(item) || typeof item.id !== 'string' || !meta) return item
  const translation = entryFor<EntryTranslation>(meta.translation, item.id, [
    'article',
    'fields',
  ])?.article
  const interaction = entryFor<InteractionMeta>(meta.interaction, item.id, [
    'isLiked',
    'likeCount',
    'readCount',
  ])
  const translationMeta: Partial<ArticleTranslation> | undefined =
    translation?.isTranslated
      ? {
          sourceLang: translation.sourceLang,
          targetLang: translation.targetLang,
          translatedAt: translation.translatedAt,
          model: translation.model,
        }
      : undefined

  return {
    ...item,
    ...(translation && {
      isTranslated: translation.isTranslated,
      sourceLang: translation.sourceLang,
      availableTranslations: translation.availableTranslations,
      translationMeta,
    }),
    ...interaction,
    ...(meta.insights && { hasInsightsInLocale: meta.insights.hasInLocale }),
    ...(meta.enrichments && { enrichments: meta.enrichments }),
    ...(meta.related && { related: meta.related }),
  }
}

/** Keep native v3 models and pagination; materialize meta needed by hydrated views. */
export function adaptResponseData<T>(
  data: T,
  meta: ResponseMeta | undefined,
  path: string,
): T {
  const route = path.split('?')[0]
  if (
    /^\/comments\/ref\//.test(route) &&
    isRecord(data) &&
    Array.isArray(data.data)
  ) {
    const readers: Record<string, ReaderModel> = {}
    const collectReader = (comment: Record<string, any>) => {
      if (comment.readerId && comment.reader)
        readers[comment.readerId] = comment.reader
      comment.replies?.forEach(collectReader)
    }
    data.data.forEach(collectReader)
    return { ...data, readers }
  }
  if (!/^\/(?:posts|notes|pages|aggregate|activity)(?:\/|$)/.test(route))
    return data
  if (Array.isArray(data))
    return data.map((item) => articleView(item, meta)) as T
  if (!isRecord(data)) return data
  if (Array.isArray(data.data)) {
    return { ...data, data: data.data.map((item) => articleView(item, meta)) }
  }
  if (typeof data.id === 'string') return articleView(data, meta) as T
  return {
    ...data,
    ...Object.fromEntries(
      ['posts', 'notes']
        .filter((key) => Array.isArray(data[key]))
        .map((key) => [
          key,
          data[key].map((item: unknown) => articleView(item, meta)),
        ]),
    ),
  }
}
