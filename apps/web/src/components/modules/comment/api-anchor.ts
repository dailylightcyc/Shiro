import type { CommentAnchorModel } from '@mx-space/api-client'

import type { CommentAnchor } from './types'

/** Convert the CMS's nullable anchor fields to the editor's discriminated union. */
export function toCommentAnchor(
  anchor: CommentAnchorModel | null,
): CommentAnchor | null {
  if (!anchor) return null
  const base = {
    blockId: anchor.blockId,
    blockType: anchor.blockType ?? '',
    blockFingerprint: anchor.blockFingerprint ?? '',
    snapshotText: anchor.snapshotText ?? '',
    lang: anchor.lang,
  }
  if (anchor.mode === 'block') return { ...base, mode: 'block' }
  if (
    anchor.mode === 'range' &&
    anchor.quote != null &&
    anchor.startOffset != null &&
    anchor.endOffset != null
  ) {
    return {
      ...base,
      mode: 'range',
      quote: anchor.quote,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
    }
  }
  return null
}
