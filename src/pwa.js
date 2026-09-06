// Service-worker registration with a performance-safe update strategy.
// A new version is applied immediately when the user is browsing the library;
// while a score is open (rehearsal/concert) or in-memory work is in flight
// (scanning, importing, backup) the reload is deferred until the page is
// hidden, the work finishes, or the user returns to the shell.
import { registerSW } from 'virtual:pwa-register'
import { requestPersistentStorage } from './lib/platform.js'

const FULLSCREEN_ROUTE = /^\/(noter\/|projekt\/[^/]+\/spela)/

let pending = false
// Number of active holds (see holdReload). While > 0 the page never reloads,
// not even when hidden: iOS may hide the page while the camera picker is open.
let holds = 0

function isFullscreenRoute() {
  return FULLSCREEN_ROUTE.test(window.location.pathname)
}

/**
 * Block app-update reloads while state that only lives in memory is at stake
 * (photos in the scan sheet, a running multi-file import, a backup in progress).
 * Returns a release function; a deferred update is applied once the last hold
 * is released, unless a score is open.
 */
export function holdReload() {
  holds++
  let released = false
  return () => {
    if (released) return
    released = true
    holds--
    if (holds === 0 && pending && !isFullscreenRoute()) applyPendingReload()
  }
}

export function applyPendingReload() {
  if (!pending || holds > 0) return
  pending = false
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.location.reload()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') applyPendingReload()
}

function scheduleDeferredReload() {
  if (pending) return
  pending = true
  // Already in the background (update finished while the user was in another
  // tab): apply right away – nobody is looking at the page.
  if (document.visibilityState === 'hidden' && holds === 0) {
    applyPendingReload()
    return
  }
  // Not `once`: the first visibilitychange may be hidden → visible, which must
  // not consume the listener. It is removed in applyPendingReload().
  document.addEventListener('visibilitychange', onVisibilityChange)
}

export function setupPwa() {
  // Ask for persistent storage early so the browser will not evict the library under pressure.
  requestPersistentStorage().catch(() => {})
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
      if (holds > 0 || isFullscreenRoute()) scheduleDeferredReload()
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
