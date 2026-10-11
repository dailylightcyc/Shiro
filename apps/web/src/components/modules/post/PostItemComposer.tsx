'use client'

import 'jotai'

import type { FC } from 'react'
import { useEffect, useRef } from 'react'

import { BottomToUpTransitionView } from '~/components/ui/transition'
import { isClientSide } from '~/lib/env'
import type { PostListItem } from '~/models/api'

import { usePostViewMode } from './atom'
import { PostCompactItem, PostLooseItem } from './PostItem'

declare global {
  export interface Window {
    __POST_LIST_ANIMATED__: boolean
  }
}

export const PostItemComposer: FC<{
  data: PostListItem
  index: number
}> = ({ data, index }) => {
  const renderedViewMode = usePostViewMode()
  const doAnimated = useRef(
    'window' in globalThis ? window.__POST_LIST_ANIMATED__ : false,
  )

  useEffect(() => {
    if (!isClientSide) return

    window.__POST_LIST_ANIMATED__ = false
  }, [])

  const Item =
    renderedViewMode === 'loose' ? (
      <PostLooseItem data={data} />
    ) : (
      <PostCompactItem data={data} />
    )

  if (!doAnimated.current) return Item
  return (
    <BottomToUpTransitionView lcpOptimization as="li" delay={index * 100}>
      {Item}
    </BottomToUpTransitionView>
  )
}
