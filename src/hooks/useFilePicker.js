import { useCallback, useEffect, useRef } from 'react'

/**
 * Programmatic file pickers. Both functions must be called from a user gesture
 * (tap/click handler) – iOS Safari otherwise ignores the click.
 *
 *   const { pickFiles, pickCamera } = useFilePicker()
 *   const files = await pickFiles({ accept: 'application/pdf,image/*', multiple: true })
 *   const [photo] = await pickCamera()   // opens the rear camera on phones/tablets
 *
 * Never include image/heic in `accept` – iOS then delivers HEIC instead of JPEG.
 */
export function useFilePicker() {
  const inputRef = useRef(null)
  const pendingRef = useRef(null)

  useEffect(() => {
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
    document.body.appendChild(input)
    inputRef.current = input
    const onChange = () => {
      const files = Array.from(input.files || [])
      input.value = ''
      pendingRef.current?.(files)
      pendingRef.current = null
    }
    // Chromium fires 'cancel' when the dialog is dismissed without a selection.
    const onCancel = () => {
      pendingRef.current?.([])
      pendingRef.current = null
    }
    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    return () => {
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      input.remove()
      inputRef.current = null
    }
  }, [])

  const open = useCallback(({ accept, multiple = false, capture = null }) => {
    const input = inputRef.current
    if (!input) return Promise.resolve([])
    return new Promise((resolve) => {
      pendingRef.current?.([])
      pendingRef.current = resolve
      input.accept = accept
      input.multiple = multiple
      if (capture) input.setAttribute('capture', capture)
      else input.removeAttribute('capture')
      input.value = ''
      input.click()
    })
  }, [])

  const pickFiles = useCallback(
    ({ accept = 'application/pdf,image/jpeg,image/png,image/webp,image/gif', multiple = true } = {}) => open({ accept, multiple }),
    [open],
  )

  const pickCamera = useCallback(() => open({ accept: 'image/*', multiple: false, capture: 'environment' }), [open])

  return { pickFiles, pickCamera }
}

export const IMPORT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
