import { useEffect } from 'react'

/** Keep the screen awake while `active` (Screen Wake Lock API; no-op if unsupported). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel = null
    let disposed = false
    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        sentinel = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel && !disposed) request()
    }
    request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release?.().catch(() => {})
      sentinel = null
    }
  }, [active])
}
