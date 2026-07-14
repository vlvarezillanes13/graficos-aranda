import { useEffect, useMemo, useState } from 'react'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import {
  fetchDeliveryDatesForItems,
  getCachedDeliveryDates,
} from '../services/deliveryDatesService'

export function useDeliveryDates(items: IncidentItem[]) {
  const [datesById, setDatesById] = useState(
    () => new Map<number, ItemDeliveryDates>(),
  )
  const [loading, setLoading] = useState(false)

  const itemIdsKey = useMemo(
    () =>
      items
        .map((item) => item.id)
        .sort((a, b) => a - b)
        .join(','),
    [items],
  )

  useEffect(() => {
    if (!itemIdsKey) {
      setDatesById(new Map())
      return
    }

    let cancelled = false
    const missing = items.filter((item) => !getCachedDeliveryDates(item.id))

    const seedFromCache = () => {
      const seeded = new Map<number, ItemDeliveryDates>()
      for (const item of items) {
        const cached = getCachedDeliveryDates(item.id)
        if (cached) seeded.set(item.id, cached)
      }
      return seeded
    }

    setDatesById(seedFromCache())

    if (missing.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)

    void fetchDeliveryDatesForItems(missing)
      .then((fetched) => {
        if (cancelled) return

        setDatesById(() => {
          const next = seedFromCache()
          for (const [id, dates] of fetched) {
            next.set(id, dates)
          }
          return next
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [itemIdsKey, items])

  return { datesById, loading }
}
