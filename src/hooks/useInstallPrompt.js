import { useCallback, useSyncExternalStore } from 'react'

// The `beforeinstallprompt` event fires once, early, and only in Chromium-based
// browsers. It is captured at module level so a component that mounts later
// (the settings page, the library banner) can still offer the button.
let deferredPrompt = null
let installed = false
let version = 0
const listeners = new Set()

function emit() {
  version++
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  // The boot script (src/pwa.js) may already have captured the event.
  if (window.__notstallInstallPrompt) deferredPrompt = window.__notstallInstallPrompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.__notstallInstallPrompt = null
    installed = true
    emit()
  })
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getSnapshot = () => version
const getServerSnapshot = () => 0

/**
 * Install prompt state for Chromium browsers.
 * Returns { canInstall, installed, prompt } where prompt() resolves to
 * 'accepted' | 'dismissed' | 'unavailable'.
 */
export function useInstallPrompt() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const prompt = useCallback(async () => {
    const evt = deferredPrompt
    if (!evt) return 'unavailable'
    try {
      await evt.prompt()
      const choice = await evt.userChoice
      // The event can only be used once, whatever the user chose.
      deferredPrompt = null
      window.__notstallInstallPrompt = null
      emit()
      return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
    } catch {
      deferredPrompt = null
      emit()
      return 'unavailable'
    }
  }, [])
  return { canInstall: !!deferredPrompt, installed, prompt }
}
