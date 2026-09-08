// Horizontal strip of page thumbnails. Uses the small cached page images
// (lib/pageCache.js) – no pdf.js decode per thumbnail – and falls back to the
// PDF for pages without one. Thumbnails render lazily (IntersectionObserver)
// once the score has more than EAGER_LIMIT pages so 300-page scores never freeze the UI.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { PdfPage } from '../PdfPage.jsx'
import { getPageBaseSize } from '../../lib/pdf.js'
import { usePdfDocument } from '../../hooks/usePdfDocument.js'
import { usePageImage, PRIORITY } from '../../lib/pageCache.js'
import { baseSizeFromMeta } from '../../lib/viewport.js'
import { cn } from '../ui/index.js'

const THUMB_H = 88
const EAGER_LIMIT = 40
const PLACEHOLDER_W = 64

const Thumb = memo(function Thumb({ doc, score, pageIndex, rotation, displayIndex, current, onSelect, root, lazy, onNeedDoc }) {
  const ref = useRef(null)
  const [near, setNear] = useState(!lazy)
  const [pageScale, setPageScale] = useState(null) // { forDoc, forIndex, forRotation, scale }

  // Mount the page only when the button is close to the visible strip.
  useEffect(() => {
    if (!lazy || near) return
    const el = ref.current
    const rootEl = root?.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { root: rootEl || null, rootMargin: '0px 600px 0px 600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy, near, root])

  const { raster, missing } = usePageImage(score, pageIndex, { thumb: true, priority: PRIORITY.score, enabled: near })
  const rasterScale = useMemo(() => {
    if (!raster) return null
    const { height } = baseSizeFromMeta(raster, rotation)
    return height ? THUMB_H / height : 1
  }, [raster, rotation])

  // A page without an image needs the PDF: ask the strip to open it.
  useEffect(() => {
    if (near && missing) onNeedDoc()
  }, [near, missing, onNeedDoc])

  // Compute the scale that gives THUMB_H height once the page proxy is known (pdf.js path).
  useEffect(() => {
    if (!near || !doc || raster) return
    let alive = true
    doc
      .getPage(pageIndex + 1)
      .then((page) => {
        if (!alive) return
        const { height } = getPageBaseSize(page, rotation)
        setPageScale({ forDoc: doc, forIndex: pageIndex, forRotation: rotation, scale: height ? THUMB_H / height : 1 })
      })
      .catch(() => {
        if (alive) setPageScale(null)
      })
    return () => {
      alive = false
    }
  }, [near, doc, raster, pageIndex, rotation])

  useEffect(() => {
    if (current) ref.current?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [current])

  const validPageScale = pageScale && pageScale.forDoc === doc && pageScale.forIndex === pageIndex && pageScale.forRotation === rotation ? pageScale.scale : null
  const scale = rasterScale ?? (doc ? validPageScale : null)

  return (
    <li className="flex shrink-0">
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(displayIndex)}
        aria-label={`Gå till sida ${displayIndex + 1}`}
        aria-current={current ? 'page' : undefined}
        data-testid={`thumb-${displayIndex}`}
        className={cn(
          'group relative flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition-colors focus-visible:outline-gold-400',
          current ? 'bg-gold-500/15 shadow-glow' : 'hover:bg-ink-700/70',
        )}
      >
        <span className="block overflow-hidden rounded-md" style={{ height: THUMB_H, minWidth: scale ? undefined : PLACEHOLDER_W }}>
          {near && scale ? (
            <PdfPage doc={raster ? null : doc} raster={raster} pageIndex={pageIndex} scale={scale} rotation={rotation} quality="thumb" className="rounded-md" />
          ) : (
            <span className="block h-full animate-pulse-soft rounded-md bg-ink-700" style={{ width: PLACEHOLDER_W }} aria-hidden="true" />
          )}
        </span>
        <span className={cn('text-[11px] tabular-nums leading-none', current ? 'text-gold-300' : 'text-ivory-400')}>{displayIndex + 1}</span>
      </button>
    </li>
  )
})

/**
 * @param {object} p
 * @param {string} p.scoreId
 * @param {object} p.score
 * @param {number[]} p.pageOrder
 * @param {Record<number,number>} p.rotations
 * @param {number} p.displayIndex
 * @param {(i:number) => void} p.onSelect
 */
export function ThumbStrip({ scoreId, score, pageOrder, rotations = {}, displayIndex, onSelect, className }) {
  const rootRef = useRef(null)
  const lazy = pageOrder.length > EAGER_LIMIT
  // The PDF is opened only when some visible thumbnail has no cached image.
  const [needDoc, setNeedDoc] = useState(false)
  const onNeedDoc = useMemo(() => () => setNeedDoc(true), [])
  const { doc } = usePdfDocument(needDoc ? scoreId : null)
  return (
    <ul
      ref={rootRef}
      className={cn('flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar', className)}
      role="list"
      aria-label="Sidor"
      data-testid="thumb-strip"
      style={{ scrollbarWidth: 'thin' }}
    >
      {pageOrder.map((pageIndex, i) => (
        <Thumb
          key={`${pageIndex}`}
          doc={doc}
          score={score}
          pageIndex={pageIndex}
          rotation={rotations[pageIndex] || 0}
          displayIndex={i}
          current={i === displayIndex}
          onSelect={onSelect}
          root={rootRef}
          lazy={lazy}
          onNeedDoc={onNeedDoc}
        />
      ))}
    </ul>
  )
}
