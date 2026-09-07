// Memoised page thumbnail for the page manager. Receives only primitive props
// (plus the score record and the pdf.js document) so drag-and-drop re-renders of
// the surrounding tile never touch the image. Renders lazily: mounted only while
// the tile is inside (or near) the scroll container's viewport and unmounted
// again when it scrolls far away, so a 300-page score keeps a small footprint.
//
// The small cached page image (lib/pageCache.js) is used whenever it exists –
// no pdf.js decode per tile; the PDF is only drawn for pages without one.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { PdfPage } from '../PdfPage.jsx'
import { getPageBaseSize } from '../../lib/pdf.js'
import { usePageImage, PRIORITY } from '../../lib/pageCache.js'
import { baseSizeFromMeta } from '../../lib/viewport.js'
import { cn } from '../ui/cn.js'

// How far outside the viewport a tile may be and still keep its image.
const NEAR_MARGIN = '720px 0px 720px 0px'

/**
 * @param {object} p
 * @param {object|null} p.doc          pdf.js document (null while loading)
 * @param {object|null} [p.score]      score record (for the cached page image)
 * @param {number} p.pageIndex         source page index
 * @param {number} p.rotation          extra rotation 0|90|180|270
 * @param {number} p.width             box width in CSS px
 * @param {number} p.height            box height in CSS px
 * @param {{current: Element|null}} [p.root]  scroll container for lazy rendering
 * @param {boolean} [p.lazy=true]      false = render immediately (drag overlay)
 * @param {string} [p.className]
 */
export const PageThumb = memo(function PageThumb({ doc, score = null, pageIndex, rotation = 0, width, height, root, lazy = true, className }) {
  const boxRef = useRef(null)
  const [near, setNear] = useState(!lazy)
  const [base, setBase] = useState(null) // { forDoc, forIndex, forRotation, w, h }

  // Track proximity to the visible area of the scroll container.
  useEffect(() => {
    if (!lazy) return
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setNear(true), 0)
      return () => clearTimeout(t)
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries[entries.length - 1]
        if (hit) setNear(hit.isIntersecting)
      },
      { root: root?.current || null, rootMargin: NEAR_MARGIN },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy, root])

  const { raster } = usePageImage(score, pageIndex, { thumb: true, priority: PRIORITY.score, enabled: near && !!score })
  const rasterBase = useMemo(() => (raster ? baseSizeFromMeta(raster, rotation) : null), [raster, rotation])

  // Unrotated-at-scale-1 size of the page, needed to fit it inside the box (pdf.js path).
  useEffect(() => {
    if (!near || !doc || raster) return
    let alive = true
    doc
      .getPage(pageIndex + 1)
      .then((page) => {
        if (!alive) return
        const { width: w, height: h } = getPageBaseSize(page, rotation)
        setBase({ forDoc: doc, forIndex: pageIndex, forRotation: rotation, w, h })
      })
      .catch(() => {
        if (alive) setBase(null)
      })
    return () => {
      alive = false
    }
  }, [near, doc, raster, pageIndex, rotation])

  const valid = base && base.forDoc === doc && base.forIndex === pageIndex && base.forRotation === rotation && base.w > 0 && base.h > 0
  const size = rasterBase && rasterBase.width > 0 ? rasterBase : valid ? { width: base.w, height: base.h } : null
  const scale = size && width && height ? Math.min(width / size.width, height / size.height) : null
  const ready = near && scale && (raster || doc)

  return (
    <div
      ref={boxRef}
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
      style={{ width, height }}
      aria-hidden="true"
    >
      {ready ? (
        <PdfPage doc={raster ? null : doc} raster={raster} pageIndex={pageIndex} scale={scale} rotation={rotation} quality="thumb" className="rounded-[3px]" />
      ) : (
        <div
          className={cn('paper rounded-[3px]', near && 'animate-pulse-soft')}
          style={{ width: Math.round(Math.min(width, height * 0.72)), height: Math.round(Math.min(height, width / 0.72)) }}
        />
      )}
    </div>
  )
})
