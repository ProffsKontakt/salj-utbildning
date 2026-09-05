// Platform detection helpers (kept tiny and side-effect free).

export const isIOS = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iDevice = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ reports as Macintosh; detect via touch points.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iDevice || iPadOS
}

export const isSafari = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(ua)
}

export const isStandalone = () => {
  if (typeof window === 'undefined') return false
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches
}

export const hasTouch = () => typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

export const supportsCameraCapture = () => {
  if (typeof document === 'undefined') return false
  const input = document.createElement('input')
  return 'capture' in input && hasTouch()
}

/** Ask the browser to keep our storage persistent. Resolves to true if granted/already persistent. */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
