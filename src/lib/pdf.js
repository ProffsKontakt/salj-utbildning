// pdf.js rendering helpers + a small ref-counted document cache.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { db } from '../db/db.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const ASSET_BASE = `${import.meta.env.BASE_URL || '/'}pdfjs/`.replace(/\/{2,}/g, '/')

export const PDFJS_LOAD_OPTIONS = {
  cMapUrl: `${ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
  wasmUrl: `${ASSET_BASE}wasm/`,
}

export { pdfjs }

// One shared worker thread for every document. Passing `worker` to getDocument
// means loadingTask.destroy() releases the document but keeps the worker alive.
let sharedWorker = null
export function getSharedWorker() {
  if (!sharedWorker || sharedWorker.destroyed) sharedWorker = new pdfjs.PDFWorker({ name: 'notstall-pdf' })
  return sharedWorker
}

/**
 * Load a PDF document from bytes. The bytes are copied because pdf.js
 * transfers the buffer to the worker (which detaches it).
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {{password?: string}} [opts]
 */
export async function loadPdfDocument(bytes, opts = {}) {
  const data = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes.slice(0))
  const task = pdfjs.getDocument({ data, worker: getSharedWorker(), ...PDFJS_LOAD_OPTIONS, ...opts })
  return task.promise
}

/** Destroy a document (pdf.js v6 exposes destroy() on the loading task, not the proxy). */
export async function destroyPdfDocument(doc) {
  if (!doc) return
  try {
    if (typeof doc.destroy === 'function') await doc.destroy()
    else if (doc.loadingTask?.destroy) await doc.loadingTask.destroy()
  } catch {
    /* ignore */
  }
}

export function isPasswordError(err) {
  return err?.name === 'PasswordException'
}

export function isRenderCancelled(err) {
  return err?.name === 'RenderingCancelledException'
}

/** True when the PDF carries an /Encrypt dictionary (pdf-lib cannot edit such files). */
export async function isEncryptedPdf(doc) {
  try {
    const perms = await doc.getPermissions()
    return perms !== null
  } catch {
    return false
  }
}

/** Human-readable Swedish message for a pdf.js load failure. */
export function describePdfError(err) {
  if (isPasswordError(err)) return 'PDF-filen är lösenordsskyddad och kan inte öppnas.'
  if (err?.name === 'InvalidPDFException') return 'Filen är inte en giltig PDF.'
  if (err?.name === 'MissingPDFException') return 'PDF-filen saknas.'
  if (err?.name === 'UnexpectedResponseException') return 'PDF-filen kunde inte läsas.'
  return err?.message ? `Kunde inte öppna PDF: ${err.message}` : 'Kunde inte öppna PDF-filen.'
}

/** Quick page count for freshly imported bytes (destroys the document afterwards). */
export async function getPdfPageCount(bytes) {
  const doc = await loadPdfDocument(bytes)
  try {
    return doc.numPages
  } finally {
    await destroyPdfDocument(doc)
  }
}

// ── Rotation & viewport ─────────────────────────────────────────────────────

/** Combine the page's intrinsic /Rotate with the user's extra rotation. */
export function effectiveRotation(page, extra = 0) {
  return (((page.rotate || 0) + (extra || 0)) % 360 + 360) % 360
}

/**
 * Viewport for a page at a given scale, honouring the intrinsic rotation plus
 * the user's extra rotation. `viewport.convertToPdfPoint(x, y)` maps CSS-pixel
 * coordinates (relative to the canvas) into PDF user space and
 * `viewport.convertToViewportPoint(px, py)` maps back.
 */
export function getPageViewport(page, { scale = 1, rotation = 0 } = {}) {
  return page.getViewport({ scale, rotation: effectiveRotation(page, rotation) })
}

/** Unrotated-at-scale-1 width/height of a page as displayed (extra rotation applied). */
export function getPageBaseSize(page, rotation = 0) {
  const vp = getPageViewport(page, { scale: 1, rotation })
  return { width: vp.width, height: vp.height }
}

/** Scale that fits a page inside a box. */
export function fitScale(page, rotation, boxWidth, boxHeight, mode = 'page') {
  const { width, height } = getPageBaseSize(page, rotation)
  if (!width || !height || !boxWidth) return 1
  if (mode === 'width') return boxWidth / width
  return Math.min(boxWidth / width, (boxHeight || Infinity) / height)
}

// Keep canvases under a safe budget: iOS ≤17 refuses canvases above 16.7 MP
// or 4096 px per side (getContext then silently draws nothing).
export const MAX_CANVAS_PIXELS = 12_000_000
export const MAX_CANVAS_SIDE = 4096

export function clampDpr(viewport, dpr) {
  const { width, height } = viewport
  if (!width || !height) return dpr
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height))
  const bySide = MAX_CANVAS_SIDE / Math.max(width, height)
  return Math.max(0.25, Math.min(dpr, byArea, bySide))
}

/**
 * Render a page onto a canvas. Returns { task, viewport }. Await `task.promise`;
 * call `task.cancel()` to abort (rejects with RenderingCancelledException).
 */
export function renderPage(page, canvas, { scale = 1, rotation = 0, dpr = window.devicePixelRatio || 1 } = {}) {
  const viewport = getPageViewport(page, { scale, rotation })
  const ratio = clampDpr(viewport, dpr)
  const w = Math.max(1, Math.floor(viewport.width * ratio))
  const h = Math.max(1, Math.floor(viewport.height * ratio))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  // pdf.js v6 takes the canvas itself and creates its own 2d context.
  const task = page.render({
    canvas,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
    background: '#ffffff',
  })
  return { task, viewport }
}

/**
 * Render a JPEG thumbnail of a page. Returns an ArrayBuffer (image/jpeg) or null.
 */
export async function renderThumbnail(doc, pageIndex, { rotation = 0, width = 260, quality = 0.82 } = {}) {
  const page = await doc.getPage(pageIndex + 1)
  const base = getPageBaseSize(page, rotation)
  const scale = width / (base.width || 1)
  const canvas = document.createElement('canvas')
  const { task } = renderPage(page, canvas, { scale, rotation, dpr: 1 })
  await task.promise
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  canvas.width = 0
  canvas.height = 0
  if (!blob) return null
  return blob.arrayBuffer()
}

// ── Document cache (ref-counted, LRU) ───────────────────────────────────────

const MAX_OPEN_DOCS = 4
/** @type {Map<string, {promise: Promise<any>, doc: any, refs: number, lastUsed: number}>} */
const cache = new Map()

function evictIdle() {
  if (cache.size <= MAX_OPEN_DOCS) return
  const idle = [...cache.entries()].filter(([, e]) => e.refs <= 0).sort((a, b) => a[1].lastUsed - b[1].lastUsed)
  while (cache.size > MAX_OPEN_DOCS && idle.length) {
    const [id, entry] = idle.shift()
    cache.delete(id)
    entry.promise.then(destroyPdfDocument).catch(() => {})
  }
}

/**
 * Acquire the pdf.js document for a score. Call `releaseScoreDocument(id)` when done.
 * The document is shared between callers and destroyed only when idle and evicted.
 */
export function acquireScoreDocument(scoreId) {
  let entry = cache.get(scoreId)
  if (!entry) {
    entry = { promise: null, doc: null, refs: 0, lastUsed: Date.now() }
    entry.promise = (async () => {
      const file = await db.files.get(scoreId)
      if (!file) throw new Error('Notfilen hittades inte i biblioteket.')
      const doc = await loadPdfDocument(file.data)
      entry.doc = doc
      return doc
    })()
    entry.promise.catch(() => {
      if (cache.get(scoreId) === entry) cache.delete(scoreId)
    })
    cache.set(scoreId, entry)
  }
  entry.refs++
  entry.lastUsed = Date.now()
  evictIdle()
  return entry.promise
}

export function releaseScoreDocument(scoreId) {
  const entry = cache.get(scoreId)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  entry.lastUsed = Date.now()
  evictIdle()
}

/** Drop a cached document (call after replacing the file bytes or deleting the score). */
export function invalidateScoreDocument(scoreId) {
  const entry = cache.get(scoreId)
  if (!entry) return
  cache.delete(scoreId)
  entry.promise.then(destroyPdfDocument).catch(() => {})
}
