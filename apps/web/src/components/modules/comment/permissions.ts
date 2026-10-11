import { useIsOwnerLogged } from '~/atoms/hooks/owner'
import { useAggregationSelector } from '~/providers/root/aggregation-data-provider'

export function useCanComment() {
  const owner = useIsOwnerLogged()
  const disabled = useAggregationSelector(
    (data) => data.commentOptions?.disableComment,
  )
  return owner || !disabled
}
