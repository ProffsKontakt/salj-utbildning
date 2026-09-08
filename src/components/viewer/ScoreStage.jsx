// The reusable heart of the viewer: renders the current page of a score fitted to
// the available area with an annotation overlay, keeps the previous and next page
// ready, and handles page-turning gestures, zoom and the annotation editor.
//
// Pages come from the device's image cache (lib/pageCache.js) whenever possible –
// no pdf.js work on a page turn. The pdf.js document is opened only when a page
// has no image yet, or to draw a sharp overlay when zoomed in.
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useElementSize } from '../../hooks/useElementSize.js'
import { usePdfDocument } from '../../hooks/usePdfDocument.js'
import { usePageImage, prepareScore, PRIORITY } from '../../lib/pageCache.js'
import { pageMetaOf, fitScaleFromMeta, baseSizeFromMeta } from '../../lib/viewport.js'
import { PdfPage } from '../PdfPage.jsx'
import { Spinner, cn, useToast } from '../ui/index.js'
import { AnnotationLayer } from './AnnotationLayer.jsx'
import { useAnnotationEditor, prefetchAnnotation } from './useAnnotationEditor.js'
import { useViewerGestures, clampZoom } from './useViewerGestures.js'

// Preload neighbours only at fit zoom: a zoomed page is up to 12 MP per canvas and a
// second one would push iOS past its total canvas budget (blank pages).
const PRELOAD_MAX_ZOOM = 1
// Beyond this zoom the cached image is visibly soft: draw the pdf.js overlay.
const SHARPEN_ZOOM = 1.25

/** Resolve (and cache) the pdf.js page proxy for a source page index. */
function usePageProxy(doc, pageIndex) {
  const [state, setState] = useState({ doc: null, pageIndex: null, page: null })
  useEffect(() => {
    if (!doc || pageIndex == null || pageIndex < 0) return
    let alive = true
    doc
      .getPage(pageIndex + 1)
      .then((page) => {
        if (alive) setState({ doc, pageIndex, page })
      })
      .catch(() => {
        if (alive) setState({ doc, pageIndex, page: null })
      })
    return () => {
      alive = false
    }
  }, [doc, pageIndex])
  return doc && state.doc === doc && state.pageIndex === pageIndex ? state.page : null
}

function roundScale(s) {
  return Math.round(s * 10000) / 10000
}

/**
 * One page slot: PdfPage + its annotation layer (owns the viewport).
 *
 * Preloaded slots are hidden inside a clipping box that covers exactly the current
 * page's box: `visibility:hidden` alone keeps the (possibly larger) neighbour in layout,
 * and an absolutely positioned descendant still extends the stage's scrollable
 * overflow – a fitted page would then be scrolled off-centre and finger swipes would
 * pan instead of turning. The annotation layer (two full-DPR canvases) is only mounted
 * for the current slot; on swap it paints the (prefetched) ink in the same commit.
 */
function StagePage({ doc, raster, pageIndex, scale, rotation, tool, toolSettings, penOnly, annotation, editor, current, slotKey, onWrapper }) {
  const [viewport, setVp] = useState(null)
  return (
    <div
      ref={(el) => onWrapper(slotKey, el)}
      className={cn(!current && 'pointer-events-none')}
      style={current ? undefined : { position: 'absolute', inset: 0, overflow: 'hidden', visibility: 'hidden' }}
      aria-hidden={current ? undefined : 'true'}
      data-stage-page={current ? 'current' : 'preload'}
    >
      <PdfPage doc={doc} raster={raster} pageIndex={pageIndex} scale={scale} rotation={rotation} onViewport={setVp}>
        {current ? (
          <AnnotationLayer viewport={viewport} tool={tool} toolSettings={toolSettings} penOnly={penOnly} annotation={annotation} interactive editor={editor} testId="annotation-canvas" />
        ) : null}
      </PdfPage>
    </div>
  )
}

/**
 * @param {object} p
 * @param {string} p.scoreId
 * @param {object} p.score              score record (pageOrder, rotations, fileVersion)
 * @param {number} p.displayIndex       position in pageOrder
 * @param {(next:number) => void} p.onNavigate
 * @param {'none'|'pen'|'highlighter'|'eraser'|'text'} [p.tool]
 * @param {object} [p.toolSettings]
 * @param {boolean} [p.penOnly]
 * @param {'page'|'width'} [p.fitMode]
 * @param {(mode:'page'|'width') => void} [p.onFitModeChange]
 * @param {number} [p.zoom]             1 = fit
 * @param {(zoom:number) => void} [p.onZoomChange]
 * @param {boolean} [p.tapToTurn]
 * @param {boolean} [p.allowOverflow]  call onNavigate with -1 / count at the ends (setlists) instead of bouncing
 * @param {object} [p.editor]   an editor from useAnnotationEditor(scoreId, pageOrder[displayIndex]) owned by the parent;
 *                              when omitted the stage creates its own
 * @param {React.RefObject} [p.editorRef]  imperative: undo/redo/canUndo/canRedo/clearPage/flush/setNote
 * @param {(s:{canUndo:boolean,canRedo:boolean,note:string,hasInk:boolean}) => void} [p.onAnnotationStateChange]
 * @param {(message:string|null) => void} [p.onOpenError]  the current page can be shown neither from the cache nor from the PDF
 * @param {() => void} [p.onCenterTap]
 * @param {string} [p.testId]
 */
export function ScoreStage({
  scoreId,
  score,
  displayIndex = 0,
  onNavigate,
  tool = 'none',
  toolSettings,
  penOnly = false,
  fitMode = 'page',
  onFitModeChange,
  zoom = 1,
  onZoomChange,
  tapToTurn = true,
  allowOverflow = false,
  editor: externalEditor,
  editorRef,
  onAnnotationStateChange,
  onOpenError,
  onCenterTap,
  testId = 'viewer-stage',
  className,
}) {
  const toast = useToast()
  const containerRef = useRef(null)
  const { width: cw, height: ch } = useElementSize(containerRef)

  const pageOrder = useMemo(() => score?.pageOrder || [], [score])
  const rotations = score?.rotations || {}
  const count = pageOrder.length
  const idx = count ? Math.min(count - 1, Math.max(0, displayIndex)) : -1
  const pageIndex = idx >= 0 ? pageOrder[idx] : null
  const nextPageIndex = idx >= 0 && idx + 1 < count ? pageOrder[idx + 1] : null
  const prevPageIndex = idx > 0 ? pageOrder[idx - 1] : null
  const rotation = pageIndex != null ? rotations[pageIndex] || 0 : 0
  const nextRotation = nextPageIndex != null ? rotations[nextPageIndex] || 0 : 0
  const prevRotation = prevPageIndex != null ? rotations[prevPageIndex] || 0 : 0
  const z = clampZoom(zoom)

  // ── Page sources: cached images first, the PDF only when needed ─────────
  const curImg = usePageImage(score, pageIndex, { priority: PRIORITY.current })
  const nextImg = usePageImage(score, nextPageIndex, { priority: PRIORITY.next })
  const prevImg = usePageImage(score, prevPageIndex, { priority: PRIORITY.prev })
  const needsDoc = !!scoreId && pageIndex != null && (curImg.missing || z > SHARPEN_ZOOM)
  const { doc, error: docError } = usePdfDocument(needsDoc ? scoreId : null)
  const curPage = usePageProxy(doc, pageIndex)
  const nextPage = usePageProxy(doc, nextPageIndex)
  const curMeta = useMemo(() => curImg.raster || (curPage ? pageMetaOf(curPage) : null), [curImg.raster, curPage])
  const nextMeta = useMemo(() => nextImg.raster || (nextPage ? pageMetaOf(nextPage) : null), [nextImg.raster, nextPage])
  const prevMeta = prevImg.raster

  // Every page of the score gets an image in the background (current/next/prev first).
  useEffect(() => {
    if (scoreId) prepareScore(scoreId, PRIORITY.score)
  }, [scoreId])

  // Nothing to show for the current page: neither an image nor a readable PDF.
  const openError = pageIndex != null && curImg.missing && docError ? docError : null
  useEffect(() => {
    onOpenError?.(openError)
  }, [openError, onOpenError])

  const pad = cw < 640 ? 8 : 20
  const boxW = Math.max(0, cw - pad * 2)
  const boxH = Math.max(0, ch - pad * 2)
  const scale = curMeta && boxW > 0 && boxH > 0 ? roundScale(fitScaleFromMeta(curMeta, rotation, boxW, boxH, fitMode) * z) : 0
  const preload = z <= PRELOAD_MAX_ZOOM && boxW > 0 && boxH > 0
  const nextScale = preload && nextMeta ? roundScale(fitScaleFromMeta(nextMeta, nextRotation, boxW, boxH, fitMode) * z) : 0
  const prevScale = preload && prevMeta ? roundScale(fitScaleFromMeta(prevMeta, prevRotation, boxW, boxH, fitMode) * z) : 0

  // ── Annotation editor for the current page ───────────────────────────
  const onSaveError = useCallback(() => toast.error('Anteckningen kunde inte sparas. Försök igen.'), [toast])
  // Hooks run unconditionally; the internal editor is inert when the parent supplies one.
  const ownEditor = useAnnotationEditor(externalEditor ? null : scoreId, pageIndex, { onSaveError })
  const editor = externalEditor || ownEditor
  const { annotation, loaded, canUndo, canRedo, note, hasInk, undo, redo, clearPage, flush, setNote, commitStroke, erase, addText, updateText, removeText } = editor
  const layerEditor = useMemo(() => ({ commitStroke, erase, addText, updateText, removeText }), [commitStroke, erase, addText, updateText, removeText])

  useImperativeHandle(
    editorRef,
    () => ({ undo, redo, canUndo, canRedo, clearPage, flush, setNote, hasInk, getAnnotation: () => annotation }),
    [undo, redo, canUndo, canRedo, clearPage, flush, setNote, hasInk, annotation],
  )

  useEffect(() => {
    onAnnotationStateChange?.({ canUndo, canRedo, note, hasInk, loaded })
  }, [onAnnotationStateChange, canUndo, canRedo, note, hasInk, loaded])

  // Prefetch the neighbours' ink into the editor cache so a page turn paints it
  // synchronously (the editor reads the cache for a page it has not loaded yet).
  useEffect(() => {
    if (!scoreId) return
    if (nextPageIndex != null) prefetchAnnotation(scoreId, nextPageIndex)
    if (prevPageIndex != null) prefetchAnnotation(scoreId, prevPageIndex)
  }, [scoreId, nextPageIndex, prevPageIndex])

  // ── Navigation ───────────────────────────────────────────────────────
  const wrapperRefs = useRef(new Map())
  const onWrapper = useCallback((key, el) => {
    if (el) wrapperRefs.current.set(key, el)
    else wrapperRefs.current.delete(key)
  }, [])
  const contentRef = useRef(null)

  const bounce = useCallback((dir) => {
    const el = contentRef.current
    if (!el || !el.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dir * -10}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' })
  }, [])

  const go = useCallback(
    (target) => {
      if (count === 0) return
      const next = Math.min(count - 1, Math.max(0, target))
      if (next === idx) {
        if (allowOverflow && target !== idx) {
          onNavigate?.(target > idx ? count : -1)
          return
        }
        bounce(target > idx ? 1 : target < idx ? -1 : 0)
        return
      }
      onNavigate?.(next)
    },
    [count, idx, onNavigate, bounce, allowOverflow],
  )
  const onPrev = useCallback(() => go(idx - 1), [go, idx])
  const onNext = useCallback(() => go(idx + 1), [go, idx])
  const onFirst = useCallback(() => go(0), [go])
  const onLast = useCallback(() => go(count - 1), [go, count])

  // Page-turn transition + scroll reset when the page changes.
  const prevIdxRef = useRef(idx)
  const pageKey = pageIndex != null ? `${scoreId}:${pageIndex}` : null
  useLayoutEffect(() => {
    const dir = idx > prevIdxRef.current ? 1 : idx < prevIdxRef.current ? -1 : 0
    prevIdxRef.current = idx
    // PdfPage sizes its box in its own layout effect (sync re-render), so measure on the next frame.
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      container.scrollTop = 0
      container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2)
    })
    if (dir && pageKey) {
      const el = wrapperRefs.current.get(pageKey)
      if (el?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        el.animate([{ opacity: 0.55, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 150, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
      }
    }
    return () => cancelAnimationFrame(frame)
  }, [idx, pageKey])

  // ── Zoom ─────────────────────────────────────────────────────────────
  const [pinch, setPinch] = useState(null) // { k, x, y } CSS preview during a pinch
  const pendingScrollRef = useRef(null) // { fx, fy, cx, cy, k }

  const commitZoom = useCallback(
    (nextZoom, focal) => {
      const next = clampZoom(nextZoom)
      if (Math.abs(next - z) < 0.001) return
      const container = containerRef.current
      if (container) {
        const fx = focal ? focal.x : container.clientWidth / 2
        const fy = focal ? focal.y : container.clientHeight / 2
        pendingScrollRef.current = { fx, fy, cx: container.scrollLeft + fx, cy: container.scrollTop + fy, k: next / z }
      }
      onZoomChange?.(next)
    },
    [z, onZoomChange],
  )

  // Keep the focal point under the finger/cursor after the page re-rendered at the new scale.
  useLayoutEffect(() => {
    const p = pendingScrollRef.current
    if (!p) return
    pendingScrollRef.current = null
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      container.scrollLeft = Math.max(0, p.cx * p.k - p.fx)
      container.scrollTop = Math.max(0, p.cy * p.k - p.fy)
    })
    return () => cancelAnimationFrame(frame)
  }, [scale])

  const toggleFit = useCallback(() => {
    onFitModeChange?.(fitMode === 'page' ? 'width' : 'page')
    if (z !== 1) onZoomChange?.(1)
  }, [fitMode, onFitModeChange, onZoomChange, z])

  const drawing = tool !== 'none'
  const enabledFor = useCallback((pointerType) => !drawing || (penOnly && pointerType === 'touch'), [drawing, penOnly])

  const gestureOpts = useMemo(
    () => ({
      enabledFor,
      tapToTurn,
      drawing,
      onPrev,
      onNext,
      onFirst,
      onLast,
      onCenterTap,
      onDoubleTap: toggleFit,
      onToggleFit: toggleFit,
      zoom: z,
      onZoomCommit: onZoomChange ? commitZoom : undefined,
      onPinchPreview: setPinch,
    }),
    [enabledFor, tapToTurn, drawing, onPrev, onNext, onFirst, onLast, onCenterTap, toggleFit, z, onZoomChange, commitZoom],
  )
  const handlers = useViewerGestures(containerRef, gestureOpts)

  // ── Render ───────────────────────────────────────────────────────────
  const pages = []
  if (pageIndex != null && scale > 0 && curMeta) {
    pages.push({ key: pageKey, pageIndex, scale, rotation, current: true, annotation, raster: curImg.raster, doc })
    if (nextPageIndex != null && nextScale > 0 && nextPageIndex !== pageIndex) {
      // Without an image the next page is still pre-rendered through pdf.js (when the document is open anyway).
      pages.push({ key: `${scoreId}:${nextPageIndex}`, pageIndex: nextPageIndex, scale: nextScale, rotation: nextRotation, current: false, annotation: null, raster: nextImg.raster, doc: nextImg.raster ? null : doc })
    }
    if (prevPageIndex != null && prevScale > 0 && prevPageIndex !== pageIndex && prevPageIndex !== nextPageIndex && prevImg.raster) {
      pages.push({ key: `${scoreId}:${prevPageIndex}`, pageIndex: prevPageIndex, scale: prevScale, rotation: prevRotation, current: false, annotation: null, raster: prevImg.raster, doc: null })
    }
  }
  // Stable DOM order (by page index) so React swaps roles rather than remounting.
  pages.sort((a, b) => a.pageIndex - b.pageIndex)

  const loading = pageIndex != null && !openError && (!curMeta || scale <= 0)
  const drawingTouch = drawing && !penOnly

  // Only hand the axes that actually overflow to native panning. On a fitted page the
  // stage keeps every touch (touch-action:none) so swipes are never cancelled by the
  // browser's scroll gesture; browser zoom is disabled by the viewport meta anyway.
  let touchAction = 'none'
  if (drawingTouch) touchAction = 'auto'
  else if (curMeta && scale > 0) {
    const base = baseSizeFromMeta(curMeta, rotation)
    const overflowX = base.width * scale + pad * 2 > cw + 1
    const overflowY = base.height * scale + pad * 2 > ch + 1
    touchAction = overflowX && overflowY ? 'pan-x pan-y' : overflowX ? 'pan-x' : overflowY ? 'pan-y' : 'none'
  }

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={cn('relative flex h-full w-full min-h-0 min-w-0 select-none overflow-auto no-callout', className)}
      style={{ touchAction, WebkitOverflowScrolling: 'touch' }}
      {...handlers}
    >
      <div
        ref={contentRef}
        className="relative m-auto"
        style={{
          padding: pad,
          transform: pinch ? `scale(${pinch.k})` : undefined,
          transformOrigin: pinch ? `${pinch.x}px ${pinch.y}px` : undefined,
          willChange: pinch ? 'transform' : undefined,
        }}
      >
        {pages.map((p) => (
          <StagePage
            key={p.key}
            slotKey={p.key}
            onWrapper={onWrapper}
            doc={p.doc}
            raster={p.raster}
            pageIndex={p.pageIndex}
            scale={p.scale}
            rotation={p.rotation}
            tool={tool}
            toolSettings={toolSettings}
            penOnly={penOnly}
            annotation={p.annotation}
            editor={layerEditor}
            current={p.current}
          />
        ))}
      </div>
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gold-300" aria-live="polite" aria-label="Laddar sida">
          <Spinner className="size-8" />
        </div>
      ) : null}
    </div>
  )
}
