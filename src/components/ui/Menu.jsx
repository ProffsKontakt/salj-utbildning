import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn.js'

/**
 * Minimal popover menu anchored to a trigger. Usage:
 * <Menu trigger={(props) => <IconButton {...props} />} items={[{label, icon, onSelect, danger, testId}]} testId="score-menu-popover" />
 * Items: { label, icon?, onSelect?, danger?, disabled?, hint?, key?, testId? } or { separator: true }.
 * Keyboard: the first item is focused on open, arrows move, Escape or selecting an item closes and refocuses the trigger.
 */
export function Menu({ trigger, items, align = 'end', testId, className, label = 'Meny' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 240
      const left = align === 'end' ? Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) : Math.max(8, Math.min(window.innerWidth - width - 8, r.left))
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow < 260 && r.top > 260 ? null : r.bottom + 6
      const bottom = top === null ? window.innerHeight - r.top + 6 : null
      setPos({ left, top, bottom, width })
    }
    place()
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      btnRef.current?.focus?.()
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align])

  // Focus the first enabled item once the popover is placed (keyboard users).
  useEffect(() => {
    if (!open || !pos) return
    const t = setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus?.(), 20)
    return () => clearTimeout(t)
  }, [open, pos])

  const onMenuKey = (e) => {
    const els = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]
    if (!els.length) return
    const i = els.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length].focus()
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
              aria-label={label}
              data-testid={testId}
              onKeyDown={onMenuKey}
              className={cn('fixed z-[150] overflow-hidden rounded-2xl bg-ink-800 p-1.5 shadow-stage animate-fade-in', className)}
              style={{ left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, width: pos.width }}
            >
              {items
                .filter(Boolean)
                .map((item, i) =>
                  item.separator ? (
                    <div key={`sep-${i}`} className="my-1 h-px bg-ivory-50/8" role="separator" />
                  ) : (
                    <button
                      key={item.key || item.label}
                      type="button"
                      role="menuitem"
                      data-testid={item.testId}
                      disabled={item.disabled}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:bg-ink-700',
                        item.danger ? 'text-[#f08a86] hover:bg-velvet-600/40' : 'text-ivory-100 hover:bg-ink-700',
                        item.disabled && 'opacity-50',
                      )}
                      onClick={() => {
                        setOpen(false)
                        // Hand focus back to the trigger before the action runs, so keyboard users
                        // continue from where they were (a dialog opened by onSelect takes it from there).
                        btnRef.current?.focus?.()
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
