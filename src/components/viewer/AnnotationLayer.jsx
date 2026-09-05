// Ink overlay for one rendered PDF page. Sits inside <PdfPage> and receives the
// viewport through PdfPage.onViewport. Two canvases: `base` holds the committed
// strokes/texts (repainted on commit or viewport change), `live` the in-progress stroke.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { clampDpr } from '../../lib/pdf.js'
import { appendPoint, makeStroke, makeText, paintAnnotation, paintStroke, strokeHit, textHit, measureText } from '../../lib/annotationPaint.js'
import { Button, cn } from '../ui/index.js'

const ERASER_RADIUS = 12
const TAP_SLOP = 8

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * @param {object} props
 * @param {object|null} props.viewport   pdf.js PageViewport (CSS size of the page)
 * @param {'none'|'pen'|'highlighter'|'eraser'|'text'} props.tool
 * @param {object} props.toolSettings    { penColor, penWidth, highlighterColor, highlighterWidth, textColor, textSize }
 * @param {boolean} props.penOnly        touch never draws (stylus/mouse only)
 * @param {object|null} props.annotation committed record { strokes, texts }
 * @param {boolean} props.interactive    false for the preloaded/hidden page
 * @param {object} props.editor          { commitStroke, erase, addText, updateText, removeText }
 * @param {string} [props.testId]        data-testid for the base canvas
 */
export function AnnotationLayer({ viewport, tool = 'none', toolSettings, penOnly = false, annotation, interactive = true, editor, testId = 'annotation-canvas' }) {
  const rootRef = useRef(null)
  const baseRef = useRef(null)
  const liveRef = useRef(null)
  const dprRef = useRef(1)
  const gestureRef = useRef(null) // active pointer gesture
  const frameRef = useRef(0)
  const [eraserPos, setEraserPos] = useState(null)
  // The inline text editor is tied to the tool it was opened with: switching tools
  // (or swapping the page) closes it. Adjusting state during render is React's
  // sanctioned pattern for "reset on prop change".
  const [textEditState, setTextEditState] = useState({ tool, edit: null }) // edit: { id|null, cssX, cssY, value, color, size, pdfX, pdfY }
  if (textEditState.tool !== tool) setTextEditState({ tool, edit: null })
  const textEdit = textEditState.tool === tool ? textEditState.edit : null
  const setTextEdit = useCallback((next) => setTextEditState((s) => ({ tool: s.tool, edit: typeof next === 'function' ? next(s.edit) : next })), [])
  const [flash, setFlash] = useState(false)

  const drawing = interactive && tool !== 'none'
  const width = viewport ? Math.round(viewport.width) : 0
  const height = viewport ? Math.round(viewport.height) : 0

  // Size both canvases to the viewport (CSS px × clamped device pixel ratio).
  useLayoutEffect(() => {
    if (!viewport) return
    const dpr = clampDpr(viewport, window.devicePixelRatio || 1)
    dprRef.current = dpr
    for (const c of [baseRef.current, liveRef.current]) {
      if (!c) continue
      const w = Math.max(1, Math.round(viewport.width * dpr))
      const h = Math.max(1, Math.round(viewport.height * dpr))
      if (c.width !== w) c.width = w
      if (c.height !== h) c.height = h
    }
  }, [viewport])

  const paintBase = useCallback(
    (record) => {
      const canvas = baseRef.current
      if (!canvas || !viewport) return
      const ctx = canvas.getContext('2d')
      paintAnnotation(ctx, viewport, record, { dpr: dprRef.current })
    },
    [viewport],
  )

  const clearLive = useCallback(() => {
    const canvas = liveRef.current
    if (!canvas || !viewport) return
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [viewport])

  // Repaint the committed record whenever it (or the viewport) changes.
  useLayoutEffect(() => {
    if (!viewport) return
    const g = gestureRef.current
    // While erasing we paint from the working copy instead.
    if (g?.kind === 'erase') return
    paintBase(annotation)
    if (!g) clearLive()
  }, [annotation, viewport, paintBase, clearLive])

  // ── Coordinate helpers ─────────────────────────────────────────────────
  const toCss = useCallback(
    (clientX, clientY) => {
      const el = rootRef.current
      if (!el || !viewport) return [0, 0]
      const r = el.getBoundingClientRect()
      const sx = r.width ? viewport.width / r.width : 1
      const sy = r.height ? viewport.height / r.height : 1
      return [(clientX - r.left) * sx, (clientY - r.top) * sy]
    },
    [viewport],
  )

  // ── Touch guards while a stroke is active ─────────────────────────────
  const guardsRef = useRef(null)
  const addGuards = useCallback(() => {
    if (guardsRef.current) return
    const prevent = (e) => e.preventDefault()
    const el = rootRef.current
    el?.addEventListener('touchmove', prevent, { passive: false })
    document.addEventListener('gesturestart', prevent, { passive: false })
    guardsRef.current = () => {
      el?.removeEventListener('touchmove', prevent)
      document.removeEventListener('gesturestart', prevent)
    }
  }, [])
  const removeGuards = useCallback(() => {
    guardsRef.current?.()
    guardsRef.current = null
  }, [])

  useEffect(() => () => removeGuards(), [removeGuards])

  // ── Live stroke painting (batched per frame) ──────────────────────────
  const schedulePaintLive = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const g = gestureRef.current
      const canvas = liveRef.current
      if (!g || g.kind !== 'stroke' || !canvas || !viewport) return
      const ctx = canvas.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      paintStroke(ctx, viewport, g.stroke, dprRef.current)
    })
  }, [viewport])

  const eraseAt = useCallback(
    (g, cssX, cssY) => {
      const ctx = baseRef.current?.getContext('2d')
      let changed = false
      for (const s of g.working.strokes) {
        if (!g.strokeIds.has(s.id) && strokeHit(s, viewport, cssX, cssY, ERASER_RADIUS)) {
          g.strokeIds.add(s.id)
          changed = true
        }
      }
      if (ctx) {
        for (const t of g.working.texts) {
          if (!g.textIds.has(t.id) && textHit(ctx, viewport, t, cssX, cssY)) {
            g.textIds.add(t.id)
            changed = true
          }
        }
      }
      if (changed) {
        paintBase({
          strokes: g.working.strokes.filter((s) => !g.strokeIds.has(s.id)),
          texts: g.working.texts.filter((t) => !g.textIds.has(t.id)),
        })
      }
    },
    [viewport, paintBase],
  )

  const endGesture = useCallback(() => {
    const g = gestureRef.current
    gestureRef.current = null
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
    removeGuards()
    return g
  }, [removeGuards])

  // ── Text editor helpers ───────────────────────────────────────────────
  const openTextEditor = useCallback(
    (cssX, cssY) => {
      if (!viewport) return
      const ctx = baseRef.current?.getContext('2d')
      const existing = ctx ? (annotation?.texts || []).find((t) => textHit(ctx, viewport, t, cssX, cssY)) : null
      if (existing) {
        const box = measureText(ctx, viewport, existing)
        setTextEdit({ id: existing.id, cssX: box.x, cssY: box.y, value: existing.text, color: existing.color, size: existing.size })
        return
      }
      const size = toolSettings?.textSize || 12
      const color = toolSettings?.textColor || '#b91c1c'
      // Baseline sits a little below the tap so the text's top starts at the finger.
      const [pdfX, pdfY] = viewport.convertToPdfPoint(cssX, cssY + size * viewport.scale * 0.85)
      setTextEdit({ id: null, cssX, cssY, value: '', color, size, pdfX, pdfY })
    },
    [viewport, annotation, toolSettings, setTextEdit],
  )

  const commitTextEditor = useCallback(
    (edit) => {
      if (!edit) return
      const text = String(edit.value || '').replace(/\s+$/g, '')
      if (edit.id) {
        if (text.trim()) editor?.updateText?.(edit.id, { text })
        else editor?.removeText?.(edit.id)
      } else if (text.trim()) {
        editor?.addText?.(makeText({ x: edit.pdfX, y: edit.pdfY, text, color: edit.color, size: edit.size }))
      }
      setTextEdit(null)
    },
    [editor, setTextEdit],
  )

  // ── Pointer events ────────────────────────────────────────────────────
  const acceptsPointer = useCallback(
    (e) => {
      if (!drawing || !viewport) return false
      if (penOnly && e.pointerType === 'touch') return false
      if (e.pointerType === 'mouse' && e.button !== 0) return false
      return e.isPrimary !== false
    },
    [drawing, viewport, penOnly],
  )

  const onPointerDown = (e) => {
    if (gestureRef.current) return
    if (!acceptsPointer(e)) {
      // A finger on a pen-only surface: nudge the user, let the stage handle the gesture.
      if (drawing && penOnly && e.pointerType === 'touch' && (tool === 'pen' || tool === 'highlighter')) {
        setFlash(true)
      }
      return
    }
    e.stopPropagation()
    const [x, y] = toCss(e.clientX, e.clientY)
    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    if (tool === 'pen' || tool === 'highlighter') {
      const stroke =
        tool === 'pen'
          ? makeStroke({ tool: 'pen', color: toolSettings?.penColor, width: toolSettings?.penWidth })
          : makeStroke({ tool: 'highlighter', color: toolSettings?.highlighterColor, width: toolSettings?.highlighterWidth })
      const [px, py] = viewport.convertToPdfPoint(x, y)
      stroke.points.push(px, py)
      gestureRef.current = { kind: 'stroke', pointerId: e.pointerId, stroke }
      addGuards()
      schedulePaintLive()
      return
    }

    if (tool === 'eraser') {
      const g = {
        kind: 'erase',
        pointerId: e.pointerId,
        working: { strokes: annotation?.strokes || [], texts: annotation?.texts || [] },
        strokeIds: new Set(),
        textIds: new Set(),
      }
      gestureRef.current = g
      addGuards()
      setEraserPos({ x, y })
      eraseAt(g, x, y)
      return
    }

    if (tool === 'text') {
      gestureRef.current = { kind: 'tap', pointerId: e.pointerId, x, y, t: nowMs() }
      addGuards()
    }
  }

  const onPointerMove = (e) => {
    const g = gestureRef.current
    if (tool === 'eraser' && e.pointerType === 'mouse' && !g) {
      const [x, y] = toCss(e.clientX, e.clientY)
      setEraserPos({ x, y })
    }
    if (!g || g.pointerId !== e.pointerId) return
    e.stopPropagation()
    const native = e.nativeEvent
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : null
    const list = events && events.length ? events : [native]

    if (g.kind === 'stroke') {
      for (const ev of list) {
        const [x, y] = toCss(ev.clientX, ev.clientY)
        const [px, py] = viewport.convertToPdfPoint(x, y)
        appendPoint(g.stroke, px, py)
      }
      schedulePaintLive()
    } else if (g.kind === 'erase') {
      let last = null
      for (const ev of list) {
        last = toCss(ev.clientX, ev.clientY)
        eraseAt(g, last[0], last[1])
      }
      if (last) setEraserPos({ x: last[0], y: last[1] })
    }
  }

  const finish = (e, cancelled = false) => {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    endGesture()
    if (g.kind === 'stroke') {
      if (!cancelled) {
        const [x, y] = toCss(e.clientX, e.clientY)
        const [px, py] = viewport.convertToPdfPoint(x, y)
        appendPoint(g.stroke, px, py)
      }
      // A cancelled gesture (e.g. the OS stole the pointer) still keeps what was drawn.
      if (g.stroke.points.length >= 2) {
        // Keep the live stroke visible until the base repaint lands (avoids a blink).
        const ctx = liveRef.current?.getContext('2d')
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.clearRect(0, 0, liveRef.current.width, liveRef.current.height)
          paintStroke(ctx, viewport, g.stroke, dprRef.current)
        }
        editor?.commitStroke?.(g.stroke)
        return
      }
      clearLive()
    } else if (g.kind === 'erase') {
      if (e.pointerType !== 'mouse') setEraserPos(null)
      if (!cancelled && (g.strokeIds.size || g.textIds.size)) {
        editor?.erase?.({ strokeIds: [...g.strokeIds], textIds: [...g.textIds] })
      } else {
        paintBase(annotation)
      }
    } else if (g.kind === 'tap') {
      if (cancelled) return
      const [x, y] = toCss(e.clientX, e.clientY)
      const moved = Math.hypot(x - g.x, y - g.y) > TAP_SLOP
      if (moved) return
      if (textEdit) {
        commitTextEditor(textEdit)
        return
      }
      openTextEditor(x, y)
    }
  }

  const onPointerLeave = () => {
    if (!gestureRef.current) setEraserPos(null)
  }

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1400)
    return () => clearTimeout(t)
  }, [flash])

  if (!viewport) return null

  const cursorClass = tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-text' : drawing ? 'cursor-crosshair' : ''

  return (
    <div
      ref={rootRef}
      className={cn('absolute inset-0', drawing ? 'ink-surface' : 'pointer-events-none', cursorClass)}
      style={{ width, height, touchAction: drawing ? 'none' : undefined }}
      onPointerDown={drawing ? onPointerDown : undefined}
      onPointerMove={drawing ? onPointerMove : undefined}
      onPointerUp={drawing ? (e) => finish(e) : undefined}
      onPointerCancel={drawing ? (e) => finish(e, true) : undefined}
      onPointerLeave={drawing ? onPointerLeave : undefined}
      onContextMenu={drawing ? (e) => e.preventDefault() : undefined}
      role={drawing ? 'application' : undefined}
      aria-label={drawing ? 'Ritlager' : undefined}
    >
      <canvas ref={baseRef} data-testid={testId} className="absolute inset-0 block" style={{ width, height }} aria-hidden="true" />
      <canvas ref={liveRef} className="absolute inset-0 block" style={{ width, height }} aria-hidden="true" />

      {tool === 'eraser' && eraserPos ? (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-velvet-400 bg-velvet-500/15 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
          style={{ left: eraserPos.x - ERASER_RADIUS, top: eraserPos.y - ERASER_RADIUS, width: ERASER_RADIUS * 2, height: ERASER_RADIUS * 2 }}
          aria-hidden="true"
        />
      ) : null}

      {flash ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center animate-fade-in" aria-live="polite">
          <span className="rounded-full bg-ink-900/90 px-3 py-1.5 text-xs text-ivory-100 shadow-stage">Endast penna är på – rita med pennan</span>
        </div>
      ) : null}

      {textEdit ? (
        <TextEditorCard
          edit={textEdit}
          pageWidth={width}
          pageHeight={height}
          onChange={(value) => setTextEdit((t) => (t ? { ...t, value } : t))}
          onConfirm={() => commitTextEditor(textEdit)}
          onCancel={() => setTextEdit(null)}
          onDelete={
            textEdit.id
              ? () => {
                  editor?.removeText?.(textEdit.id)
                  setTextEdit(null)
                }
              : null
          }
        />
      ) : null}
    </div>
  )
}

const CARD_W = 232
const CARD_H = 132

function TextEditorCard({ edit, pageWidth, pageHeight, onChange, onConfirm, onCancel, onDelete }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const left = Math.max(4, Math.min(pageWidth - CARD_W - 4, edit.cssX))
  const top = edit.cssY + CARD_H + 8 > pageHeight ? Math.max(4, edit.cssY - CARD_H - 8) : edit.cssY + 4
  return (
    <div
      className="ink-surface absolute z-10 flex flex-col gap-2 rounded-2xl bg-ink-850 p-2.5 text-ivory-100 shadow-stage animate-fade-in"
      style={{ left, top, width: CARD_W, touchAction: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={edit.id ? 'Redigera textanteckning' : 'Ny textanteckning'}
    >
      <textarea
        ref={ref}
        rows={2}
        value={edit.value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onConfirm()
          }
        }}
        placeholder="Skriv en anteckning…"
        className="w-full resize-none rounded-xl bg-ink-800 px-3 py-2 text-[15px] leading-snug text-ivory-50 placeholder:text-ivory-500 hairline focus:outline-none focus:shadow-glow"
        style={{ color: edit.color, touchAction: 'auto', userSelect: 'text', WebkitUserSelect: 'text' }}
        aria-label="Text"
      />
      <div className="flex items-center gap-1">
        {onDelete ? (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-[#f08a86]" aria-label="Ta bort text">
            <Trash2 className="size-4" />
            Ta bort
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Avbryt
        </Button>
        <Button variant="primary" size="sm" onClick={onConfirm}>
          Klar
        </Button>
      </div>
    </div>
  )
}
