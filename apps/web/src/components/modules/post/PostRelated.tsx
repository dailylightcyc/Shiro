'use client'

import type { PostRelatedSummary } from '@mx-space/api-client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { FC } from 'react'

import { apiClient } from '~/lib/request'
import { useCurrentPostDataSelector } from '~/providers/post/CurrentPostDataProvider'

import { PeekLink } from '../peek/PeekLink'

export const PostRelated: FC<{
  type?: 'before' | 'after'
}> = ({ type = 'after' }) => {
  const t = useTranslations('post')
  const infoText = type === 'before' ? t('related_before') : t('related_after')
  const related = useCurrentPostDataSelector((s) => s?.related)
  if (!related) {
    return null
  }

  if (related.length === 0) {
    return null
  }
  return (
    <div data-hide-print className="prose mb-5 mt-8">
      <h3 className="flex items-center gap-2 text-lg font-medium">
        <i className="i-mingcute-question-line" />
        <span>{infoText}</span>
      </h3>
      <ul className="ml-0 mt-4 list-inside list-disc pl-0 text-base leading-relaxed">
        {related.map((post) => {
          const href = post.category
            ? `/posts/${post.category.slug}/${post.slug}`
            : undefined
          return <RelatedPostLink key={post.id} post={post} href={href} />
        })}
      </ul>
    </div>
  )
}

function RelatedPostLink({
  post,
  href,
}: {
  post: PostRelatedSummary
  href?: string
}) {
  const { data } = useQuery({
    queryKey: ['post-url', post.id],
    enabled: !href && !!post.slug,
    queryFn: () => apiClient.post.getFullUrl(post.slug),
  })
  const path = href || (data?.path ? `/posts${data.path}` : undefined)
  if (!path) return null
  return (
    <li>
      <PeekLink href={path} className="shiro-link--underline">
        {post.title}
      </PeekLink>
    </li>
  )
}
