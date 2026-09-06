import { useEffect } from 'react'
import { holdReload } from '../pwa.js'

/**
 * Keep a service-worker update from reloading the page while `active` is true
 * (work whose state lives only in memory: scanning, importing, backup).
 */
export function useHoldReload(active) {
  useEffect(() => {
    if (!active) return
    return holdReload()
  }, [active])
}
