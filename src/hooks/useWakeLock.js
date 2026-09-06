import { useEffect } from 'react'

/** Keep the screen awake while `active` (Screen Wake Lock API; no-op if unsupported). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel = null
    let disposed = false
    let retryOnGesture = false
    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (disposed) {
          // Resolved after cleanup (viewer closed / keepAwake toggled off): don't keep the screen awake.
          s.release().catch(() => {})
          return
        }
        sentinel = s
        s.addEventListener('release', () => {
          if (sentinel === s) sentinel = null
        })
      } catch {
        // Some browsers require user activation: retry on the next tap.
        if (disposed) return
        sentinel = null
        retryOnGesture = true
      }
    }
    const onGesture = () => {
      if (retryOnGesture && !sentinel && !disposed) {
        retryOnGesture = false
        request()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel && !disposed) request()
    }
    request()
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pointerdown', onGesture, { passive: true })
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('pointerdown', onGesture)
      sentinel?.release?.().catch(() => {})
      sentinel = null
    }
  }, [active])
}
