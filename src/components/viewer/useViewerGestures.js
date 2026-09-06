// Page-turning gestures for the stage: tap zones, horizontal swipe, double-tap,
// mouse/finger drag-to-pan when zoomed, two-finger pinch zoom and keyboard shortcuts.
//
// The hook returns React pointer handlers to spread on the stage element (React
// handlers are used so the annotation layer's stopPropagation is honoured) and
// attaches native touch/keyboard listeners itself.
import { useCallback, useEffect, useMemo, useRef } from 'react'

const SWIPE_MIN = 60
const TAP_SLOP = 10
const TAP_MAX_MS = 350
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_DIST = 40
export const ZOOM_MIN = 1
export const ZOOM_MAX = 4

export function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1))
}

function isEditableTarget(t) {
  if (!t || !(t instanceof Element)) return false
  if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true
  if (t.closest('[role="dialog"], [role="menu"]')) return true
  return false
}

/**
 * @param {React.RefObject<HTMLElement>} ref  scroll container (the stage)
 * @param {object} o
 * @param {(pointerType: string) => boolean} o.enabledFor  whether tap/swipe/pinch apply for a pointer type
 * @param {boolean} o.tapToTurn
 * @param {() => void} o.onPrev
 * @param {() => void} o.onNext
 * @param {() => void} [o.onFirst]
 * @param {() => void} [o.onLast]
 * @param {() => void} [o.onCenterTap]
 * @param {(x:number, y:number) => void} [o.onDoubleTap]
 * @param {number} o.zoom
 * @param {(zoom:number, focal:{x:number,y:number}|null) => void} [o.onZoomCommit]
 * @param {(preview:{k:number,x:number,y:number}|null) => void} [o.onPinchPreview]
 * @param {boolean} [o.keyboard=true]
 */
export function useViewerGestures(ref, o) {
  const optsRef = useRef(o)
  useEffect(() => {
    optsRef.current = o
  })

  const pointerRef = useRef(null) // { id, type, x0, y0, x, y, t0, panned, native }
  const lastTapRef = useRef(null) // { t, x, y }
  const pinchRef = useRef(null) // { d0, zoom0, k, cx, cy }
  const frameRef = useRef(0)

  const isScrollable = useCallback(() => {
    const el = ref.current
    if (!el) return false
    return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
  }, [ref])

  const onPointerDown = useCallback(
    (e) => {
      const opts = optsRef.current
      if (!opts.enabledFor(e.pointerType)) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (!e.isPrimary) return
      if (pinchRef.current) return
      // A finger on the ink surface has native scrolling suppressed (touch-action:none);
      // we then pan manually. Mice always pan manually.
      const native = e.pointerType === 'touch' && !(e.target instanceof Element && e.target.closest('.ink-surface'))
      pointerRef.current = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), panned: false, native }
    },
    [],
  )

  const onPointerMove = useCallback(
    (e) => {
      const p = pointerRef.current
      if (!p || p.id !== e.pointerId) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!p.native && isScrollable()) {
        const total = Math.hypot(e.clientX - p.x0, e.clientY - p.y0)
        if (p.panned || total > TAP_SLOP) {
          p.panned = true
          const el = ref.current
          if (el) {
            el.scrollLeft -= dx
            el.scrollTop -= dy
          }
        }
      }
    },
    [ref, isScrollable],
  )

  const onPointerUp = useCallback(
    (e) => {
      const p = pointerRef.current
      if (!p || p.id !== e.pointerId) return
      pointerRef.current = null
      const opts = optsRef.current
      const el = ref.current
      if (!el || p.panned) return
      const dx = e.clientX - p.x0
      const dy = e.clientY - p.y0
      const dt = performance.now() - p.t0
      const dist = Math.hypot(dx, dy)

      // Horizontal swipe with little vertical drift.
      if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dy) < Math.max(48, Math.abs(dx) * 0.6) && dt < 800) {
        if (dx < 0) opts.onNext?.()
        else opts.onPrev?.()
        lastTapRef.current = null
        return
      }
      if (dist > TAP_SLOP || dt > TAP_MAX_MS) return

      const r = el.getBoundingClientRect()
      const fx = (e.clientX - r.left) / Math.max(1, r.width)
      const now = performance.now()
      const last = lastTapRef.current
      if (last && now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_DIST) {
        lastTapRef.current = null
        opts.onDoubleTap?.(e.clientX - r.left, e.clientY - r.top)
        return
      }
      if (opts.tapToTurn && fx < 0.3) {
        lastTapRef.current = null
        opts.onPrev?.()
        return
      }
      if (opts.tapToTurn && fx > 0.7) {
        lastTapRef.current = null
        opts.onNext?.()
        return
      }
      lastTapRef.current = { t: now, x: e.clientX, y: e.clientY }
      opts.onCenterTap?.()
    },
    [ref],
  )

  const onPointerCancel = useCallback((e) => {
    const p = pointerRef.current
    if (p && p.id === e.pointerId) pointerRef.current = null
  }, [])

  // ── Pinch zoom (two fingers, native touch events, non-passive) ─────────
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const centre = (t) => {
      const r = el.getBoundingClientRect()
      return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top }
    }
    const onStart = (e) => {
      const opts = optsRef.current
      if (e.touches.length !== 2 || !opts.enabledFor('touch') || !opts.onZoomCommit) return
      e.preventDefault()
      pointerRef.current = null
      const c = centre(e.touches)
      pinchRef.current = { d0: Math.max(1, dist(e.touches)), zoom0: opts.zoom || 1, k: 1, cx: c.x, cy: c.y }
    }
    const onMove = (e) => {
      const pinch = pinchRef.current
      if (!pinch || e.touches.length < 2) return
      e.preventDefault()
      const raw = dist(e.touches) / pinch.d0
      // Clamp the preview so the page cannot be shrunk below fit or beyond max zoom.
      pinch.k = clampZoom(pinch.zoom0 * raw) / pinch.zoom0
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0
          const cur = pinchRef.current
          if (cur) optsRef.current.onPinchPreview?.({ k: cur.k, x: cur.cx, y: cur.cy })
        })
      }
    }
    const onEnd = (e) => {
      const pinch = pinchRef.current
      if (!pinch || e.touches.length >= 2) return
      pinchRef.current = null
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
      const opts = optsRef.current
      opts.onPinchPreview?.(null)
      const next = clampZoom(pinch.zoom0 * pinch.k)
      if (Math.abs(next - pinch.zoom0) > 0.01) opts.onZoomCommit?.(next, { x: pinch.cx, y: pinch.cy })
    }
    const onGesture = (e) => e.preventDefault()
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    el.addEventListener('gesturestart', onGesture, { passive: false })
    el.addEventListener('gesturechange', onGesture, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('gesturestart', onGesture)
      el.removeEventListener('gesturechange', onGesture)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [ref])

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const opts = optsRef.current
      if (opts.keyboard === false) return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      // Space/Enter on a focused control belong to that control.
      const onControl = e.target instanceof Element && !!e.target.closest('button, a, [role="button"], [role="switch"], [role="radio"]')
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault()
          opts.onNext?.()
          break
        case ' ':
          if (onControl) return
          e.preventDefault()
          if (e.shiftKey) opts.onPrev?.()
          else opts.onNext?.()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          opts.onPrev?.()
          break
        case 'Home':
          e.preventDefault()
          opts.onFirst?.()
          break
        case 'End':
          e.preventDefault()
          opts.onLast?.()
          break
        case 'f':
        case 'F':
          if (onControl) return
          e.preventDefault()
          opts.onToggleFit?.()
          break
        default:
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return useMemo(() => ({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel }), [onPointerDown, onPointerMove, onPointerUp, onPointerCancel])
}
