// Popover menu for the viewer top bar. Mirrors ui/Menu but lets every item carry a
// data-testid (the shared Menu does not forward arbitrary item props).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../ui/index.js'

/**
 * @param {object} p
 * @param {(props:object) => React.ReactNode} p.trigger
 * @param {Array<{label:string, icon?:any, onSelect?:() => void, danger?:boolean, disabled?:boolean, testId?:string, hint?:string, key?:string, separator?:boolean}>} p.items
 */
export function ViewerMenu({ trigger, items, align = 'end' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 248
      const left = align === 'end' ? Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) : Math.max(8, Math.min(window.innerWidth - width - 8, r.left))
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow < 300 && r.top > 300 ? null : r.bottom + 6
      const bottom = top === null ? window.innerHeight - r.top + 6 : null
      setPos({ left, top, bottom, width })
    }
    place()
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        btnRef.current?.focus?.()
      }
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
    }
  }, [open, align])

  // Focus the first item when opened (keyboard users).
  useEffect(() => {
    if (!open || !pos) return
    const t = setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus?.(), 20)
    return () => clearTimeout(t)
  }, [open, pos])

  const onMenuKey = (e) => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]
    if (!items.length) return
    const i = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length].focus()
    }
  }

  return (
    <>
      {trigger({ ref: btnRef, onClick: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Meny"
              onKeyDown={onMenuKey}
              className="fixed z-[150] overflow-hidden rounded-2xl bg-ink-800 p-1.5 shadow-stage animate-fade-in"
              style={{ left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, width: pos.width }}
            >
              {items.filter(Boolean).map((item, i) =>
                item.separator ? (
                  <div key={`sep-${i}`} className="my-1 h-px bg-ivory-50/8" role="separator" />
                ) : (
                  <button
                    key={item.key || item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    data-testid={item.testId}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:bg-ink-700',
                      item.danger ? 'text-[#f08a86] hover:bg-velvet-600/40' : 'text-ivory-100 hover:bg-ink-700',
                      item.disabled && 'opacity-50',
                    )}
                    onClick={() => {
                      setOpen(false)
                      item.onSelect?.()
                    }}
                  >
                    {item.icon ? <item.icon className="size-[18px] shrink-0 opacity-80" /> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? <span className="text-xs text-ivory-500">{item.hint}</span> : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
