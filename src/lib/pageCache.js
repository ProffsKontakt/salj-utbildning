// Pre-rendered page images ("snabbvisning").
//
// pdf.js has to decode every scanned page in JavaScript each time it is shown –
// one to three seconds per page on an iPad, which is far too slow for a page turn
// on stage. So every page is rasterised once, in the background, to a JPEG at a
// Retina-class resolution and stored on the device. The viewer shows that image
// (hardware-decoded, instant) and only falls back to pdf.js for pages that are
// not cached yet or when zoomed in beyond the image's resolution.
//
// The cache is device-local and regenerable: it is never synced or exported, and
// it is dropped whenever the file bytes change (page manager, re-download) or
// the score leaves the device.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProjectLinks } from '../db/db.js'
import { acquireScoreDocument, releaseScoreDocument, getPageBaseSize, renderPage, MAX_CANVAS_SIDE } from './pdf.js'
import { pageMetaOf } from './viewport.js'
import { isDrawing } from './penState.js'

/** Longest side of a cached page image in pixels (≈ 12.9" iPad at Retina, fit-to-page). */
export const RASTER_LONG_EDGE = 2600
const JPEG_QUALITY = 0.86
/** Longest side of the small per-page thumbnail stored next to the image (thumb strip, page manager). */
export const THUMB_LONG_EDGE = 480
const THUMB_QUALITY = 0.8
const YIELD_MS = 10
const FAILURE_BACKOFF_MS = 15_000

/** Lower = sooner. */
export const PRIORITY = { current: 0, next: 1, prev: 2, score: 5, nextScore: 6, project: 7, import: 8 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Is this cached image still valid for the score's current file? Rotation is not
 * part of the check: a rotated page shows the same image turned with CSS.
 */
export function isFreshImage(meta, score, pageIndex) {
  if (!meta || !score || meta.scoreId !== score.id || meta.pageIndex !== pageIndex) return false
  return meta.fileVersion === (score.fileVersion || 0) && meta.longEdge === RASTER_LONG_EDGE && !!meta.thumb
}

// ── Build queue ─────────────────────────────────────────────────────────────

const jobs = [] // { scoreId, pages: Set<number>|null (= every page), priority, seq }
let seq = 0
let running = false
const failedAt = new Map() // scoreId → time of the last failed job
const status = new Map() // scoreId → { done, total } while a job for it runs
const listeners = new Set()

function emitStatus() {
  for (const l of listeners) l()
}

function setStatus(scoreId, value) {
  if (value) status.set(scoreId, value)
  else status.delete(scoreId)
  emitStatus()
}

/**
 * Ask for page images of a score. `pageIndexes` = null means every page in the
 * score's page order. Requests for the same score and priority are merged.
 */
export function requestPages(scoreId, pageIndexes, priority = PRIORITY.current) {
  if (!scoreId) return
  const failed = failedAt.get(scoreId)
  if (failed && Date.now() - failed < FAILURE_BACKOFF_MS) return
  const pages = pageIndexes == null ? null : pageIndexes.filter((i) => Number.isInteger(i) && i >= 0)
  if (pages && !pages.length) return
  const existing = jobs.find((j) => j.scoreId === scoreId && j.priority === priority)
  if (existing) {
    if (pages === null) existing.pages = null
    else if (existing.pages) for (const p of pages) existing.pages.add(p)
  } else {
    jobs.push({ scoreId, pages: pages ? new Set(pages) : null, priority, seq: seq++ })
  }
  kick()
}

/** Render every page of a score (import, download, "make ready for the stage"). */
export function prepareScore(scoreId, priority = PRIORITY.score) {
  requestPages(scoreId, null, priority)
}

/** Render every page of every score in a project, in setlist order. */
export async function prepareProject(projectId, priority = PRIORITY.project) {
  const links = await getProjectLinks(projectId)
  for (const l of links) prepareScore(l.scoreId, priority)
}

/**
 * Queue every score on this device whose pages are not all cached (app start:
 * a reload may have interrupted a build, and cloud scores downloaded elsewhere in
 * the app arrive without images). Cheap – only counts, no bytes are read.
 */
export async function warmPageCache(priority = PRIORITY.import) {
  const ids = await db.files.toCollection().primaryKeys()
  if (!ids.length) return 0
  const scores = await db.scores.bulkGet(ids)
  let queued = 0
  for (const score of scores) {
    if (!score) continue
    const wanted = new Set(score.pageOrder || [])
    if (!wanted.size) continue
    const metas = await db.pageImages.where('scoreId').equals(score.id).toArray()
    const fresh = metas.filter((m) => isFreshImage(m, score, m.pageIndex) && wanted.has(m.pageIndex)).length
    if (fresh >= wanted.size) continue
    prepareScore(score.id, priority)
    queued++
  }
  return queued
}

/** Whether a build is queued or running for a score. */
export function isPreparing(scoreId) {
  return status.has(scoreId) || jobs.some((j) => j.scoreId === scoreId)
}

async function kick() {
  if (running) return
  running = true
  try {
    while (jobs.length) {
      jobs.sort((a, b) => a.priority - b.priority || a.seq - b.seq)
      const job = jobs.shift()
      try {
        await runJob(job)
      } catch (err) {
        failedAt.set(job.scoreId, Date.now())
        console.warn('[pageCache]', job.scoreId, err)
      } finally {
        setStatus(job.scoreId, null)
      }
    }
  } finally {
    running = false
  }
}

async function runJob({ scoreId, pages }) {
  const score = await db.scores.get(scoreId)
  if (!score) return
  const order = score.pageOrder || []
  const wanted = pages ? [...pages].filter((i) => i < (score.pageCount || Infinity)) : [...new Set(order)]
  if (!wanted.length) return
  const metas = await db.pageImages.where('scoreId').equals(scoreId).toArray()
  const have = new Map(metas.map((m) => [m.pageIndex, m]))
  const todo = wanted.filter((i) => !isFreshImage(have.get(i), score, i))
  if (!todo.length) return
  setStatus(scoreId, { done: wanted.length - todo.length, total: wanted.length })

  // The file may be missing (cloud-only score): acquire throws, the job is dropped.
  const doc = await acquireScoreDocument(scoreId)
  const canvas = document.createElement('canvas')
  try {
    let done = wanted.length - todo.length
    for (const pageIndex of todo) {
      // Never compete with a pen stroke for the main thread.
      while (isDrawing()) await sleep(120)
      const fresh = await db.scores.get(scoreId)
      if (!fresh || (fresh.fileVersion || 0) !== (score.fileVersion || 0)) return
      const rotation = (fresh.rotations || {})[pageIndex] || 0
      const image = await renderPageImage(doc, pageIndex, rotation, canvas)
      await db.transaction('rw', db.pageImages, db.pageImageBlobs, async () => {
        await db.pageImageBlobs.put({ scoreId, pageIndex, data: image.data })
        await db.pageImages.put({
          scoreId,
          pageIndex,
          fileVersion: fresh.fileVersion || 0,
          rotation,
          longEdge: RASTER_LONG_EDGE,
          width: image.width,
          height: image.height,
          size: image.data.byteLength + image.thumb.byteLength,
          thumb: image.thumb,
          viewBox: image.viewBox,
          userUnit: image.userUnit,
          rotate: image.rotate,
          createdAt: Date.now(),
        })
      })
      done++
      setStatus(scoreId, { done, total: wanted.length })
      await sleep(YIELD_MS)
    }
  } finally {
    canvas.width = 0
    canvas.height = 0
    releaseScoreDocument(scoreId)
  }
}

async function renderPageImage(doc, pageIndex, rotation, canvas) {
  const page = await doc.getPage(pageIndex + 1)
  try {
    const meta = pageMetaOf(page)
    const base = getPageBaseSize(page, rotation)
    const longest = Math.max(base.width, base.height) || 1
    const scale = Math.min(RASTER_LONG_EDGE, MAX_CANVAS_SIDE) / longest
    const { task } = renderPage(page, canvas, { scale, rotation, dpr: 1 })
    await task.promise
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte koda sidbilden.'))), 'image/jpeg', JPEG_QUALITY))
    const data = await blob.arrayBuffer()
    // Small thumbnail from the same pixels (no second decode of the page).
    const k = THUMB_LONG_EDGE / Math.max(canvas.width, canvas.height, 1)
    const small = document.createElement('canvas')
    small.width = Math.max(1, Math.round(canvas.width * k))
    small.height = Math.max(1, Math.round(canvas.height * k))
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height)
    const thumbBlob = await new Promise((resolve, reject) => small.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte koda miniatyren.'))), 'image/jpeg', THUMB_QUALITY))
    const thumb = await thumbBlob.arrayBuffer()
    small.width = 0
    small.height = 0
    return { data, thumb, width: canvas.width, height: canvas.height, ...meta }
  } finally {
    page.cleanup()
  }
}

// ── Object URLs (small LRU so pages next to the current one stay decoded) ──

const urls = new Map() // key → { url, lastUsed }
const URL_CAP = 32
const URL_GRACE_MS = 3000

export function imageKey(meta, variant = 'full') {
  return `${variant}:${meta.scoreId}:${meta.pageIndex}:${meta.fileVersion}:${meta.longEdge}`
}

function urlFor(meta, data, variant = 'full') {
  const key = imageKey(meta, variant)
  let entry = urls.get(key)
  if (!entry) {
    entry = { url: URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })), lastUsed: 0 }
    urls.set(key, entry)
  }
  entry.lastUsed = performance.now()
  if (urls.size > URL_CAP) {
    const idle = [...urls.entries()].filter(([, e]) => performance.now() - e.lastUsed > URL_GRACE_MS).sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    while (urls.size > URL_CAP && idle.length) {
      const [k, e] = idle.shift()
      urls.delete(k)
      URL.revokeObjectURL(e.url)
    }
  }
  return entry.url
}

// ── React hooks ──────────────────────────────────────────────────────────────

/**
 * The cached image of one page, requested (built) on demand.
 * @param {object|null} score      score record (id, fileVersion, rotations)
 * @param {number|null} pageIndex  source page index
 * @param {{ priority?: number, enabled?: boolean, thumb?: boolean }} [opts]  thumb: the small variant
 * @returns {{ raster: object|null, loading: boolean, missing: boolean }}
 *   raster   { url, width, height, viewBox, userUnit, rotate, rotation (as rendered), fileVersion, pxPerUnit }
 *   loading  the local lookup (or the blob read) has not finished yet
 *   missing  no fresh image exists yet – a build was requested; render live meanwhile
 */
export function usePageImage(score, pageIndex, { priority = PRIORITY.current, enabled = true, thumb = false } = {}) {
  const scoreId = enabled && score ? score.id : null
  const active = !!scoreId && Number.isInteger(pageIndex) && pageIndex >= 0
  const lookup = useLiveQuery(
    async () => {
      if (!active) return null
      const meta = (await db.pageImages.get([scoreId, pageIndex])) ?? null
      return { scoreId, pageIndex, meta }
    },
    [active, scoreId, pageIndex],
    undefined,
  )
  const current = lookup && lookup.scoreId === scoreId && lookup.pageIndex === pageIndex ? lookup : null
  const fresh = current?.meta && isFreshImage(current.meta, score, pageIndex) ? current.meta : null
  const known = active && !!current
  const missing = known && !fresh
  const fileVersion = score?.fileVersion || 0

  // Request a build whenever the page is known to be missing or stale.
  useEffect(() => {
    if (!missing) return
    requestPages(scoreId, [pageIndex], priority)
  }, [missing, scoreId, pageIndex, fileVersion, priority])

  const variant = thumb ? 'thumb' : 'full'
  const key = fresh ? imageKey(fresh, variant) : null
  // The thumbnail travels with the metadata row – no second read, derived synchronously.
  const thumbRaster = useMemo(() => (thumb && fresh ? rasterOf({ url: urlFor(fresh, fresh.thumb, 'thumb'), meta: fresh }) : null), [thumb, fresh])
  const [img, setImg] = useState(null) // { key, url, meta }
  useEffect(() => {
    if (!key || variant === 'thumb') return
    let alive = true
    db.pageImageBlobs
      .get([scoreId, pageIndex])
      .then((row) => {
        if (!alive) return
        // Metadata without bytes (interrupted write): drop it so the page is rebuilt.
        if (!row?.data) return db.pageImages.delete([scoreId, pageIndex]).catch(() => {})
        setImg({ key, url: urlFor(fresh, row.data, 'full'), meta: fresh })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // `fresh` is fully described by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, variant, scoreId, pageIndex])

  const raster = thumb ? thumbRaster : key && img && img.key === key ? rasterOf(img) : null
  return { raster, loading: active && (!known || (!!key && !raster)), missing }
}

function rasterOf(img) {
  const meta = { ...img.meta }
  delete meta.thumb
  return { url: img.url, ...meta, pxPerUnit: meta.width / Math.max(1, rasterBaseWidth(meta)) }
}

/** Width (PDF units) of the page as it was rendered: the viewBox side that is horizontal at the stored rotation. */
function rasterBaseWidth(meta) {
  const [x0, y0, x1, y1] = meta.viewBox
  const total = ((((meta.rotate || 0) + (meta.rotation || 0)) % 360) + 360) % 360
  const w = (x1 - x0) * (meta.userUnit || 1)
  const h = (y1 - y0) * (meta.userUnit || 1)
  return total === 90 || total === 270 ? h : w
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Build progress for a score: { done, total } while pages are being prepared, else null. */
export function usePageCacheStatus(scoreId) {
  const get = () => (scoreId ? status.get(scoreId) || null : null)
  return useSyncExternalStore(subscribe, get, get)
}
