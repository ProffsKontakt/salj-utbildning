import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { renderPage, isRenderCancelled, getPageViewport } from '../lib/pdf.js'
import { cn } from './ui/cn.js'

/**
 * Renders one PDF page to a canvas at `scale` (CSS px per PDF pt) with the
 * user's extra `rotation`. Children (e.g. an annotation layer) are absolutely
 * positioned over the page and receive the current viewport through the
 * `onViewport` callback. The element's size follows the viewport exactly, so
 * pointer coordinates relative to it are CSS pixels convertible with
 * `viewport.convertToPdfPoint(x, y)`.
 *
 * Rendering is double-buffered: while a new scale/rotation renders into the
 * hidden canvas, the previous image stays visible (stretched to the new size),
 * so zooming and fit changes never flash to a blank page. The pulsing paper
 * placeholder is only shown before the very first successful render of a page.
 *
 * Props: doc (pdf.js document), pageIndex (0-based source index), scale,
 * rotation (0|90|180|270), onViewport(viewport), onRendered(), className,
 * quality: 'screen' (device pixel ratio) | 'thumb' (dpr 1).
 */
export const PdfPage = memo(function PdfPage({ doc, pageIndex, scale = 1, rotation = 0, onViewport, onRendered, className, children, quality = 'screen', style }) {
  const canvasARef = useRef(null)
  const canvasBRef = useRef(null)
  const [page, setPage] = useState(null)
  const [size, setSize] = useState(null)
  const [error, setError] = useState(null)
  // which buffer currently shows a completed render (0 = A, 1 = B, -1 = none yet)
  const [active, setActive] = useState(-1)
  const [rendered, setRendered] = useState(false)

  // Load the page proxy.
  useEffect(() => {
    let cancelled = false
    if (!doc) return
    doc
      .getPage(pageIndex + 1)
      .then((p) => {
        if (!cancelled) setPage(p)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Sidan kunde inte läsas.')
      })
    return () => {
      cancelled = true
    }
  }, [doc, pageIndex])

  // Reset buffers when the page identity changes (derived, not in an effect body).
  const identityRef = useRef(null)
  const identity = `${pageIndex}`
  if (identityRef.current !== identity) {
    identityRef.current = identity
    if (active !== -1) setActive(-1)
    if (rendered) setRendered(false)
    if (page && page.pageNumber !== pageIndex + 1) setPage(null)
  }

  // Size the box immediately (before render finishes) so layout is stable.
  useLayoutEffect(() => {
    if (!page) return
    const vp = getPageViewport(page, { scale, rotation })
    setSize({ width: vp.width, height: vp.height })
    onViewport?.(vp)
  }, [page, scale, rotation, onViewport])

  // Render into the inactive buffer, then swap (cancellable).
  useEffect(() => {
    if (!page) return
    const target = active === 0 ? canvasBRef.current : canvasARef.current
    const targetIndex = active === 0 ? 1 : 0
    if (!target) return
    let cancelled = false
    const dpr = quality === 'thumb' ? 1 : window.devicePixelRatio || 1
    const { task } = renderPage(page, target, { scale, rotation, dpr })
    task.promise
      .then(() => {
        if (cancelled) return
        setActive(targetIndex)
        setRendered(true)
        onRendered?.()
        // Thumbnails stay mounted for the whole strip/grid and never re-render at
        // another scale, so drop the page's decoded images as soon as they are drawn.
        if (quality === 'thumb') page.cleanup()
      })
      .catch((e) => {
        if (cancelled || isRenderCancelled(e)) return
        setError(e?.message || 'Sidan kunde inte ritas.')
      })
    return () => {
      cancelled = true
      task.cancel()
    }
    // `active` is intentionally excluded: a completed swap must not trigger a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale, rotation, quality, onRendered])

  // Release pdf.js page resources when the page goes away. pdf.js keeps every decoded
  // image (ImageBitmap) and the operator list in the page proxy until cleanup() is
  // called, so a session that has viewed many scanned pages would otherwise hold
  // one full-resolution bitmap per page (iOS jetsams the tab). Declared after the
  // render effect so task.cancel() runs first; cleanup() is a no-op while another
  // render of the same page (e.g. the thumb strip) is in flight and runs when it ends.
  useEffect(() => {
    if (!page) return
    return () => {
      page.cleanup()
    }
  }, [page])

  // Release the buffer that just went off-screen: a stale full-DPR bitmap per page
  // would otherwise stay allocated for the rest of the session (iOS canvas budget).
  useLayoutEffect(() => {
    if (active === -1) return
    const other = active === 0 ? canvasBRef.current : canvasARef.current
    if (other && other.width) {
      other.width = 0
      other.height = 0
    }
  }, [active])

  const showPlaceholder = active === -1 && !error
  const canvasStyle = (index) => ({
    display: active === index ? 'block' : 'none',
    // stretch the previous image to the new box while the other buffer renders
    width: size ? `${size.width}px` : undefined,
    height: size ? `${size.height}px` : undefined,
  })

  return (
    <div
      className={cn('relative paper overflow-hidden', className)}
      style={{ width: size?.width, height: size?.height, ...style }}
      data-page-index={pageIndex}
      data-rendered={rendered ? 'true' : 'false'}
    >
      <canvas ref={canvasARef} className="absolute inset-0" style={canvasStyle(0)} aria-label={`Sida ${pageIndex + 1}`} />
      <canvas ref={canvasBRef} className="absolute inset-0" style={canvasStyle(1)} aria-hidden="true" />
      {showPlaceholder ? <div className="absolute inset-0 animate-pulse-soft bg-paper" aria-hidden="true" /> : null}
      {error ? <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-700">{error}</div> : null}
      {children}
    </div>
  )
})
