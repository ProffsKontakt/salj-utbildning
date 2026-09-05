import { useCallback, useEffect } from 'react'

/**
 * Programmatic file pickers. Both functions must be called from a user gesture
 * (tap/click handler) – iOS Safari otherwise ignores the click.
 *
 *   const { pickFiles, pickCamera } = useFilePicker()
 *   const files = await pickFiles({ accept: 'application/pdf,image/*', multiple: true })
 *   const [photo] = await pickCamera()   // opens the rear camera on phones/tablets
 *
 * A single hidden <input type="file"> is shared by every hook instance (only one
 * picker can be open at a time anyway), so the DOM always has at most one
 * element with data-testid="file-picker".
 *
 * Never include image/heic in `accept` – iOS then delivers HEIC instead of JPEG.
 */

export const IMPORT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

let sharedInput = null
let pending = null
let users = 0

function settle(files) {
  const resolve = pending
  pending = null
  resolve?.(files)
}

function ensureInput() {
  if (sharedInput && sharedInput.isConnected) return sharedInput
  const input = document.createElement('input')
  input.type = 'file'
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.width = '1px'
  input.style.height = '1px'
  input.style.opacity = '0'
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  input.setAttribute('data-testid', 'file-picker')
  input.addEventListener('change', () => {
    const files = Array.from(input.files || [])
    input.value = ''
    settle(files)
  })
  // Chromium fires 'cancel' when the dialog is dismissed without a selection.
  input.addEventListener('cancel', () => settle([]))
  document.body.appendChild(input)
  sharedInput = input
  return input
}

function openPicker({ accept, multiple = false, capture = null }) {
  const input = ensureInput()
  return new Promise((resolve) => {
    settle([]) // resolve any stale pending picker
    pending = resolve
    input.accept = accept
    input.multiple = multiple
    if (capture) input.setAttribute('capture', capture)
    else input.removeAttribute('capture')
    input.value = ''
    input.click()
  })
}

export function useFilePicker() {
  useEffect(() => {
    users++
    ensureInput()
    return () => {
      users--
      if (users <= 0 && sharedInput) {
        settle([])
        sharedInput.remove()
        sharedInput = null
        users = 0
      }
    }
  }, [])

  const pickFiles = useCallback(({ accept = IMPORT_ACCEPT, multiple = true } = {}) => openPicker({ accept, multiple }), [])
  const pickCamera = useCallback(() => openPicker({ accept: 'image/*', multiple: false, capture: 'environment' }), [])

  return { pickFiles, pickCamera }
}
