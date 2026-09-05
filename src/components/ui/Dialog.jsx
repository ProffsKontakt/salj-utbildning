import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from './cn.js'
import { IconButton } from './IconButton.jsx'
import { Button } from './Button.jsx'

/**
 * Modal dialog. Centered card on ≥sm screens, bottom sheet on phones.
 * Closes on Escape and backdrop tap. Renders nothing when `open` is false.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', className, closeLabel = 'Stäng' }) {
  const panelRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // focus the first focusable element
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('input, textarea, select, button:not([data-close])')
      el?.focus?.()
    }, 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-in-plain" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-ink-850 text-ivory-100 shadow-stage',
          'rounded-t-3xl pb-safe sm:rounded-3xl sm:pb-0 animate-slide-up sm:animate-fade-in',
          widths[size] || widths.md,
          className,
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="font-display text-2xl leading-tight text-ivory-50">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-ivory-400">{description}</p> : null}
          </div>
          <IconButton label={closeLabel} size="sm" onClick={onClose} data-close className="-mr-2 -mt-1">
            <X />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ivory-50/8 px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/** Yes/no confirmation. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Ta bort', cancelLabel = 'Avbryt', danger = true, loading = false }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message ? <p className="text-[15px] leading-relaxed text-ivory-200">{message}</p> : null}
    </Dialog>
  )
}
