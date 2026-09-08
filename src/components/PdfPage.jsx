import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { renderPage, isRenderCancelled, getPageViewport } from '../lib/pdf.js'
import { viewportFromMeta } from '../lib/viewport.js'
import { cn } from './ui/cn.js'

// Draw the pdf.js overlay when the page is shown sharper than the cached image.
const SHARPEN_FACTOR = 1.25

/**
 * Renders one PDF page at `scale` (CSS px per PDF pt) with the user's extra
 * `rotation`. Children (e.g. an annotation layer) are absolutely positioned over
 * the page and receive the current viewport through `onViewport`. The element's
 * size follows the viewport exactly, so pointer coordinates relative to it are
 * CSS pixels convertible with `viewport.convertToPdfPoint(x, y)`.
 *
 * Two sources, in order of preference:
 *  - `raster`: a pre-rendered image of the page (see lib/pageCache.js). Shown as
 *    an <img> – decoded by the browser, instant, no pdf.js work at all. The page's
 *    geometry comes with it, so no document is needed. A rotation that differs
 *    from the stored one is applied with CSS.
 *  - `doc`: the pdf.js document, used when there is no image yet, and to draw a
 *    sharp overlay when the page is zoomed beyond the image's resolution.
 *
 * pdf.js rendering is double-buffered so a re-render never flashes to blank.
 *
 * Props: doc, pageIndex (0-based source index), scale, rotation (0|90|180|270),
 * raster ({ url, width, height, viewBox, userUnit, rotate, rotation, pxPerUnit } | null),
 * onViewport(viewport), onRendered(), className, quality: 'screen' | 'thumb',
 * sharpen (default true): allow the pdf.js overlay when zoomed.
 */
export const PdfPage = memo(function PdfPage({ doc, pageIndex, scale = 1, rotation = 0, raster = null, onViewport, onRendered, className, children, quality = 'screen', sharpen = true, style }) {
  const canvasARef = useRef(null)
  const canvasBRef = useRef(null)
  const imgRef = useRef(null)
  const [pageState, setPageState] = useState({ doc: null, pageIndex: null, page: null })
  const page = doc && pageState.doc === doc && pageState.pageIndex === pageIndex ? pageState.page : null
  const [error, setError] = useState(null)
  // which buffer currently shows a completed pdf.js render (0 = A, 1 = B, -1 = none)
  const [active, setActive] = useState(-1)
  const [canvasRendered, setCanvasRendered] = useState(false)
  const [imgLoadedUrl, setImgLoadedUrl] = useState(null)

  // Load the page proxy (only when a document is available).
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    doc
      .getPage(pageIndex + 1)
      .then((p) => {
        if (!cancelled) setPageState({ doc, pageIndex, page: p })
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
    if (canvasRendered) setCanvasRendered(false)
    if (imgLoadedUrl) setImgLoadedUrl(null)
  }

  // Geometry: from the cached image's metadata when we have it, else from the page proxy.
  const viewport = useMemo(() => {
    if (raster) return viewportFromMeta(raster, { scale, rotation })
    if (page) return getPageViewport(page, { scale, rotation })
    return null
  }, [raster, page, scale, rotation])
  const size = viewport ? { width: viewport.width, height: viewport.height } : null

  useLayoutEffect(() => {
    if (viewport) onViewport?.(viewport)
  }, [viewport, onViewport])

  const dpr = quality === 'thumb' ? 1 : typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  // pdf.js draws when there is no image, or (screen quality) when zoomed past its resolution.
  const needCanvas = !!page && (!raster || (sharpen && quality === 'screen' && scale * dpr > (raster.pxPerUnit || 0) * SHARPEN_FACTOR))
  // No overlay wanted any more: forget the finished buffer (derived, not in an effect).
  if (!needCanvas && active !== -1) setActive(-1)

  // Render into the inactive buffer, then swap (cancellable).
  useEffect(() => {
    if (!needCanvas) return
    const target = active === 0 ? canvasBRef.current : canvasARef.current
    const targetIndex = active === 0 ? 1 : 0
    if (!target) return
    let cancelled = false
    const { task } = renderPage(page, target, { scale, rotation, dpr })
    task.promise
      .then(() => {
        if (cancelled) return
        setActive(targetIndex)
        setCanvasRendered(true)
        onRendered?.()
        // Thumbnails never re-render at another scale: drop the decoded images right away.
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
  }, [needCanvas, page, scale, rotation, dpr, quality, onRendered])

  // Release pdf.js page resources when the page goes away (decoded bitmaps are big).
  useEffect(() => {
    if (!page) return
    return () => {
      page.cleanup()
    }
  }, [page])

  // Release the buffer that went off-screen, and both when the overlay is no longer needed.
  useLayoutEffect(() => {
    const free = (c) => {
      if (c && c.width) {
        c.width = 0
        c.height = 0
      }
    }
    if (!needCanvas) {
      free(canvasARef.current)
      free(canvasBRef.current)
      return
    }
    if (active === -1) return
    free(active === 0 ? canvasBRef.current : canvasARef.current)
  }, [active, needCanvas])

  // An image that is already decoded (same URL reused) may not fire onLoad again.
  const imgUrl = raster?.url || null
  useEffect(() => {
    if (!imgUrl) return
    const frame = requestAnimationFrame(() => {
      const el = imgRef.current
      if (el && el.complete && el.naturalWidth > 0) setImgLoadedUrl(imgUrl)
    })
    return () => cancelAnimationFrame(frame)
  }, [imgUrl])

  const imgReady = !!imgUrl && imgLoadedUrl === imgUrl
  const showCanvas = needCanvas && active !== -1
  const rendered = imgReady || (showCanvas && canvasRendered)
  useEffect(() => {
    if (imgReady) onRendered?.()
  }, [imgReady, onRendered])

  const showPlaceholder = !rendered && !error
  const canvasStyle = (index) => ({
    display: showCanvas && active === index ? 'block' : 'none',
    width: size ? `${size.width}px` : undefined,
    height: size ? `${size.height}px` : undefined,
  })

  // The stored image may be turned differently from the current rotation: rotate it with CSS.
  let imgStyle = null
  if (raster && size) {
    const delta = ((((rotation || 0) - (raster.rotation || 0)) % 360) + 360) % 360
    const turned = delta === 90 || delta === 270
    const w = turned ? size.height : size.width
    const h = turned ? size.width : size.height
    imgStyle = { width: w, height: h, left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${delta}deg)` }
  }

  return (
    <div
      className={cn('relative paper overflow-hidden', className)}
      style={{ width: size?.width, height: size?.height, ...style }}
      data-page-index={pageIndex}
      data-rendered={rendered ? 'true' : 'false'}
      data-source={imgReady && !showCanvas ? 'image' : showCanvas ? 'pdf' : 'none'}
    >
      {imgUrl ? (
        <img
          ref={imgRef}
          src={imgUrl}
          alt={`Sida ${pageIndex + 1}`}
          decoding="async"
          draggable={false}
          className="absolute block max-w-none select-none"
          style={{ ...imgStyle, visibility: imgReady ? 'visible' : 'hidden' }}
          onLoad={() => setImgLoadedUrl(imgUrl)}
          onError={() => setError('Sidbilden kunde inte visas.')}
        />
      ) : null}
      <canvas ref={canvasARef} className="absolute inset-0" style={canvasStyle(0)} aria-label={imgUrl ? undefined : `Sida ${pageIndex + 1}`} aria-hidden={imgUrl ? 'true' : undefined} />
      <canvas ref={canvasBRef} className="absolute inset-0" style={canvasStyle(1)} aria-hidden="true" />
      {showPlaceholder ? <div className="absolute inset-0 animate-pulse-soft bg-paper" aria-hidden="true" /> : null}
      {error && !rendered ? <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-700">{error}</div> : null}
      {children}
    </div>
  )
})
