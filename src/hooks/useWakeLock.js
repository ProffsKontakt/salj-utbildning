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
        sentinel = await navigator.wakeLock.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        // Some browsers require user activation: retry on the next tap.
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
