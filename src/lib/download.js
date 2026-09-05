// Saving/sharing files across platforms.
//
// iOS (especially installed home-screen apps) cannot download via <a download>.
// The reliable path there is the Web Share sheet with *only* `files` set, which
// offers "Spara i Filer", AirDrop, Mail, forScore … On desktop we prefer the
// File System Access picker, then fall back to an anchor download.

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
 * @returns {Promise<'shared'|'saved'|'downloaded'|'cancelled'>}
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
      // fall through to other strategies
    }
  }

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: ext ? [{ description: mime, accept: { [mime]: [ext] } }] : undefined,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // fall through
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
