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
 * Props: doc (pdf.js document), pageIndex (0-based source index), scale,
 * rotation (0|90|180|270), onViewport(viewport), onRendered(), className,
 * quality: 'screen' (device pixel ratio) | 'thumb' (dpr 1).
 */
export const PdfPage = memo(function PdfPage({ doc, pageIndex, scale = 1, rotation = 0, onViewport, onRendered, className, children, quality = 'screen', style }) {
  const canvasRef = useRef(null)
  const [page, setPage] = useState(null)
  const [size, setSize] = useState(null)
  const [error, setError] = useState(null)
  const [rendered, setRendered] = useState(false)

  // Load the page proxy.
  useEffect(() => {
    let active = true
    setPage(null)
    setRendered(false)
    setError(null)
    if (!doc) return
    doc
      .getPage(pageIndex + 1)
      .then((p) => {
        if (active) setPage(p)
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Sidan kunde inte läsas.')
      })
    return () => {
      active = false
    }
  }, [doc, pageIndex])

  // Size the box immediately (before render finishes) so layout is stable.
  useLayoutEffect(() => {
    if (!page) return
    const vp = getPageViewport(page, { scale, rotation })
    setSize({ width: vp.width, height: vp.height })
    onViewport?.(vp)
  }, [page, scale, rotation, onViewport])

  // Render (cancellable).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!page || !canvas) return
    let cancelled = false
    setRendered(false)
    const dpr = quality === 'thumb' ? 1 : window.devicePixelRatio || 1
    const { task } = renderPage(page, canvas, { scale, rotation, dpr })
    task.promise
      .then(() => {
        if (cancelled) return
        setRendered(true)
        onRendered?.()
      })
      .catch((e) => {
        if (cancelled || isRenderCancelled(e)) return
        setError(e?.message || 'Sidan kunde inte ritas.')
      })
    return () => {
      cancelled = true
      task.cancel()
    }
  }, [page, scale, rotation, quality, onRendered])

  return (
    <div
      className={cn('relative paper overflow-hidden', className)}
      style={{ width: size?.width, height: size?.height, ...style }}
      data-page-index={pageIndex}
      data-rendered={rendered ? 'true' : 'false'}
    >
      <canvas ref={canvasRef} className="block" aria-label={`Sida ${pageIndex + 1}`} />
      {!rendered && !error ? <div className="absolute inset-0 animate-pulse-soft bg-paper" aria-hidden="true" /> : null}
      {error ? <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-700">{error}</div> : null}
      {children}
    </div>
  )
})
