// Service-worker registration with a performance-safe update strategy.
// A new version is applied immediately when the user is browsing the library;
// while a score is open (rehearsal/concert) the reload is deferred until the
// page is hidden or the user returns to the shell.
import { registerSW } from 'virtual:pwa-register'

const FULLSCREEN_ROUTE = /^\/(noter\/|projekt\/[^/]+\/spela)/

let pending = false

export function hasPendingReload() {
  return pending
}

export function applyPendingReload() {
  if (!pending) return
  pending = false
  window.location.reload()
}

function scheduleDeferredReload() {
  pending = true
  const onHide = () => {
    if (document.visibilityState === 'hidden') applyPendingReload()
  }
  document.addEventListener('visibilitychange', onHide, { once: true })
}

export function setupPwa() {
  // Chromium fires `beforeinstallprompt` once, early. Stash it at boot so the
  // lazily loaded install UI (settings page, library banner) can still use it.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.__notstallInstallPrompt = e
  })
  window.addEventListener('appinstalled', () => {
    window.__notstallInstallPrompt = null
  })
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onNeedReload() {
      if (FULLSCREEN_ROUTE.test(window.location.pathname)) scheduleDeferredReload()
      else window.location.reload()
    },
    onRegisterError(err) {
      console.warn('Service worker registration failed', err)
    },
  })
  // A stale tab may request a lazy chunk that no longer exists after a deploy.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    window.location.reload()
  })
}
