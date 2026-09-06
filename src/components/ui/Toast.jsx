import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from './cn.js'
import { ToastContext } from './toastContext.js'

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, { type = 'info', duration = 3200, action } = {}) => {
      const id = ++counter
      setToasts((t) => [...t.slice(-3), { id, message, type, action }])
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (m, o) => push(m, { ...o, type: 'success' }),
      error: (m, o) => push(m, { ...o, type: 'error', duration: o?.duration ?? 5000 }),
      info: (m, o) => push(m, { ...o, type: 'info' }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-6" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink-800/95 px-4 py-3 text-sm text-ivory-50 shadow-stage backdrop-blur animate-fade-in',
                t.type === 'error' && 'shadow-[inset_0_0_0_1px_rgba(217,83,79,0.5),0_20px_60px_-20px_rgba(0,0,0,0.75)]',
                t.type === 'success' && 'shadow-[inset_0_0_0_1px_rgba(76,175,125,0.45),0_20px_60px_-20px_rgba(0,0,0,0.75)]',
              )}
            >
              {t.type === 'success' ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : t.type === 'error' ? <AlertTriangle className="size-5 shrink-0 text-danger" /> : <Info className="size-5 shrink-0 text-gold-300" />}
              <span className="min-w-0 flex-1 leading-snug">{t.message}</span>
              {t.action ? (
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-gold-300 hover:bg-ink-700"
                  onClick={() => {
                    t.action.onClick?.()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
              <button type="button" aria-label="Stäng" className="shrink-0 rounded-lg p-1 text-ivory-400 hover:bg-ink-700 hover:text-ivory-100" onClick={() => dismiss(t.id)}>
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
