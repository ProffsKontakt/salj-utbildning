// Saving/sharing files across platforms.
//
// iOS (especially installed home-screen apps) cannot download via <a download>.
// The reliable path there is the Web Share sheet with *only* `files` set, which
// offers "Spara i Filer", AirDrop, Mail, forScore … Everywhere else a plain
// anchor download is used (the File System Access picker is deliberately not
// used: it is Chromium-only, needs its own activation and hangs headless runs).

import { isIOS } from './platform.js'

export function supportsFileShare(file) {
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
  } catch {
    return false
  }
}

/**
 * Save or share a file. Must be called from a user gesture (tap/click).
 * @param {Blob|ArrayBuffer} data
 * @param {string} name  file name including extension
 * @param {string} mime
 * @returns {Promise<'shared'|'downloaded'|'cancelled'|'failed'>}
 *   'failed' is returned on iOS when the share sheet rejects for a reason other
 *   than the user cancelling (lost activation, a share already in progress, …):
 *   the anchor fallback would silently do nothing there, so callers must show an
 *   error and offer a retry inside a fresh tap.
 */
export async function saveFile(data, name, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const file = new File([blob], name, { type: mime })

  if (supportsFileShare(file)) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // On iOS the anchor download below is a no-op (see header): report the
      // failure honestly instead of pretending the file was saved.
      if (isIOS()) return 'failed'
      // elsewhere fall through to the anchor download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 4000)
  return 'downloaded'
}

/** Turn a title into a safe file name. */
export function safeFileName(title, ext = 'pdf') {
  const base = String(title || 'noter')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80)
  return `${base || 'noter'}.${ext}`
}
