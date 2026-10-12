'use client'

import { useTranslations } from 'next-intl'
import type { ElementType } from 'react'

import {
  CircleProgress,
  MaterialSymbolsProgressActivity,
} from '~/components/icons/Progress'
import { MotionButtonBase } from '~/components/ui/button'
import { IconSmoothTransition } from '~/components/ui/transition'
import { useReadPercent } from '~/hooks/shared/use-read-percent'
import { clsxm } from '~/lib/helper'
import { springScrollToTop } from '~/lib/scroller'

export const ReadIndicator: Component<{
  as?: ElementType
}> = ({ className, as }) => {
  const t = useTranslations('common')
  const readPercent = useReadPercent()
  const As = as || 'span'

  return (
    <As className={clsxm('text-zinc-800 dark:text-neutral-300', className)}>
      <div className="flex items-center gap-2">
        <IconSmoothTransition
          solidIcon={<MaterialSymbolsProgressActivity />}
          regularIcon={
            <CircleProgress percent={readPercent} size={14} strokeWidth={2} />
          }
          currentState={readPercent !== 0 ? 'regular' : 'solid'}
        />
        {readPercent}%<br />
      </div>
      <MotionButtonBase
        onClick={springScrollToTop}
        className={clsxm(
          'mt-1 flex flex-nowrap items-center gap-2 opacity-50 transition-all duration-500 hover:opacity-100',
          readPercent > 10 ? '' : 'pointer-events-none opacity-0',
        )}
      >
        <i className="i-mingcute-arrow-up-circle-line" />
        <span className="whitespace-nowrap">{t('back_to_top')}</span>
      </MotionButtonBase>
    </As>
  )
}
