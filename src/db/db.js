// ─────────────────────────────────────────────────────────────────────────────
// Notställ – local-first storage layer (Dexie / IndexedDB)
//
// Tables
//   scores        { id, title, composer, voice, key, notes, pageCount, fileSize,
//                   pageOrder:number[], rotations:{[srcPage]:0|90|180|270},
//                   thumb:ArrayBuffer|null, thumbMime, createdAt, updatedAt, lastOpenedAt }
//   files         { id (=scoreId), data:ArrayBuffer (PDF bytes), mime, size, name }
//   annotations   { scoreId, pageIndex (source page index), strokes:Stroke[], texts:TextNote[], note, updatedAt }
//                   Stroke   = { id, tool:'pen'|'highlighter', color:'#rrggbb', width:pt, opacity:0..1,
//                                points:number[] (flat x0,y0,x1,y1,… in PDF user space) }
//                   TextNote = { id, x, y, text, color:'#rrggbb', size:pt }   (PDF user space, baseline-left)
//   projects      { id, name, date:'YYYY-MM-DD'|'', venue, notes, createdAt, updatedAt }
//   projectScores { id, projectId, scoreId, position }
//   settings      { key, value }
//
// All coordinates for annotations are stored in PDF user space so they survive
// zoom, rotation and export. Page indices in pageOrder/rotations/annotations
// always refer to the *source* PDF page index (0-based), never the display order.
// ─────────────────────────────────────────────────────────────────────────────
import Dexie from 'dexie'
import { uid } from '../lib/ids.js'

export const db = new Dexie('notstall')

db.version(1).stores({
  scores: 'id, title, composer, updatedAt, createdAt, lastOpenedAt',
  files: 'id',
  annotations: '[scoreId+pageIndex], scoreId',
  projects: 'id, name, date, updatedAt',
  projectScores: 'id, projectId, scoreId, [projectId+position]',
  settings: 'key',
})
// v2: compound index for "is this score in this project" lookups.
db.version(2).stores({
  projectScores: 'id, projectId, scoreId, [projectId+position], [projectId+scoreId]',
})

export const now = () => Date.now()

export const ROTATIONS = [0, 90, 180, 270]

export function normalizeRotation(deg) {
  const r = ((Math.round(deg / 90) * 90) % 360 + 360) % 360
  return r
}

// ── Scores ──────────────────────────────────────────────────────────────────

/**
 * Create a score from PDF bytes. Optionally attach it to a project.
 * @returns {Promise<object>} the stored score record
 */
export async function createScore({
  title,
  composer = '',
  voice = '',
  key = '',
  notes = '',
  pdfBytes,
  pageCount,
  thumb = null,
  fileName = '',
  projectId = null,
}) {
  if (!(pdfBytes instanceof ArrayBuffer)) throw new TypeError('pdfBytes must be an ArrayBuffer')
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('pageCount must be ≥ 1')
  const id = uid()
  const t = now()
  const score = {
    id,
    title: (title || '').trim() || 'Namnlöst stycke',
    composer: (composer || '').trim(),
    voice: (voice || '').trim(),
    key: (key || '').trim(),
    notes: notes || '',
    pageCount,
    fileSize: pdfBytes.byteLength,
    pageOrder: Array.from({ length: pageCount }, (_, i) => i),
    rotations: {},
    thumb,
    thumbMime: 'image/jpeg',
    createdAt: t,
    updatedAt: t,
    lastOpenedAt: 0,
  }
  await db.transaction('rw', db.scores, db.files, db.projectScores, db.projects, async () => {
    await db.scores.add(score)
    await db.files.add({ id, data: pdfBytes, mime: 'application/pdf', size: pdfBytes.byteLength, name: fileName })
    if (projectId) await addScoresToProject(projectId, [id])
  })
  return score
}

export function getScore(id) {
  return db.scores.get(id)
}

export function getScoreFile(id) {
  return db.files.get(id)
}

export async function updateScore(id, patch) {
  const clean = { ...patch }
  delete clean.id
  return db.scores.update(id, { ...clean, updatedAt: now() })
}

export async function touchScoreOpened(id) {
  return db.scores.update(id, { lastOpenedAt: now() })
}

/**
 * Replace the PDF bytes of a score (e.g. after appending pages).
 * pageOrder/rotations must already refer to the new file's page indices.
 */
export async function replaceScoreFile(id, { pdfBytes, pageCount, pageOrder, rotations, thumb }) {
  if (!(pdfBytes instanceof ArrayBuffer)) throw new TypeError('pdfBytes must be an ArrayBuffer')
  await db.transaction('rw', db.scores, db.files, async () => {
    const file = await db.files.get(id)
    await db.files.put({
      id,
      data: pdfBytes,
      mime: 'application/pdf',
      size: pdfBytes.byteLength,
      name: file?.name || '',
    })
    const patch = { pageCount, fileSize: pdfBytes.byteLength, updatedAt: now() }
    if (pageOrder) patch.pageOrder = pageOrder
    if (rotations) patch.rotations = rotations
    if (thumb !== undefined) patch.thumb = thumb
    await db.scores.update(id, patch)
  })
}

export async function deleteScore(id) {
  await db.transaction('rw', db.scores, db.files, db.annotations, db.projectScores, async () => {
    await db.scores.delete(id)
    await db.files.delete(id)
    await db.annotations.where('scoreId').equals(id).delete()
    const links = await db.projectScores.where('scoreId').equals(id).toArray()
    await db.projectScores.bulkDelete(links.map((l) => l.id))
    // keep positions contiguous in affected projects
    const projectIds = [...new Set(links.map((l) => l.projectId))]
    for (const pid of projectIds) await renumberProject(pid)
  })
}

export async function deleteScores(ids) {
  for (const id of ids) await deleteScore(id)
}

/** Total PDF bytes stored (from score metadata, so no file data is loaded). */
export async function totalFileBytes() {
  let total = 0
  await db.scores.each((s) => {
    total += s.fileSize || 0
  })
  return total
}

// ── Annotations ─────────────────────────────────────────────────────────────

export function emptyAnnotation(scoreId, pageIndex) {
  return { scoreId, pageIndex, strokes: [], texts: [], note: '', updatedAt: 0 }
}

export function getAnnotation(scoreId, pageIndex) {
  return db.annotations.get([scoreId, pageIndex])
}

export function getAnnotationsForScore(scoreId) {
  return db.annotations.where('scoreId').equals(scoreId).toArray()
}

/** Map<pageIndex, annotation> for a score. */
export async function getAnnotationMap(scoreId) {
  const list = await getAnnotationsForScore(scoreId)
  return new Map(list.map((a) => [a.pageIndex, a]))
}

/**
 * Persist a page's annotation. Empty annotations are deleted to keep the table lean.
 */
export async function putAnnotation(scoreId, pageIndex, { strokes = [], texts = [], note = '' } = {}) {
  const isEmpty = strokes.length === 0 && texts.length === 0 && !note
  if (isEmpty) {
    await db.annotations.delete([scoreId, pageIndex])
    return null
  }
  const rec = { scoreId, pageIndex, v: 1, strokes, texts, note, updatedAt: now() }
  await db.annotations.put(rec)
  return rec
}

export async function clearAnnotationsForScore(scoreId) {
  await db.annotations.where('scoreId').equals(scoreId).delete()
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function createProject({ name, date = '', venue = '', notes = '' }) {
  const t = now()
  const project = {
    id: uid(),
    name: (name || '').trim() || 'Nytt projekt',
    date: date || '',
    venue: (venue || '').trim(),
    notes: notes || '',
    createdAt: t,
    updatedAt: t,
  }
  await db.projects.add(project)
  return project
}

export function getProject(id) {
  return db.projects.get(id)
}

export async function updateProject(id, patch) {
  const clean = { ...patch }
  delete clean.id
  return db.projects.update(id, { ...clean, updatedAt: now() })
}

export async function deleteProject(id) {
  await db.transaction('rw', db.projects, db.projectScores, async () => {
    await db.projects.delete(id)
    await db.projectScores.where('projectId').equals(id).delete()
  })
}

/** Ordered link records for a project (without score records). */
export function getProjectLinks(projectId) {
  return db.projectScores.where('projectId').equals(projectId).sortBy('position')
}

/** Ordered [{ link, score }] for a project; skips links whose score was deleted. */
export async function getProjectSetlist(projectId) {
  const links = await getProjectLinks(projectId)
  const scores = await db.scores.bulkGet(links.map((l) => l.scoreId))
  return links.map((link, i) => ({ link, score: scores[i] })).filter((x) => x.score)
}

export async function addScoresToProject(projectId, scoreIds) {
  return db.transaction('rw', db.projectScores, db.projects, async () => {
    const existing = await db.projectScores.where('projectId').equals(projectId).toArray()
    const have = new Set(existing.map((l) => l.scoreId))
    let pos = existing.length ? Math.max(...existing.map((l) => l.position)) + 1 : 0
    const rows = []
    for (const scoreId of scoreIds) {
      if (have.has(scoreId)) continue
      have.add(scoreId)
      rows.push({ id: uid(), projectId, scoreId, position: pos++ })
    }
    if (rows.length) await db.projectScores.bulkAdd(rows)
    await db.projects.update(projectId, { updatedAt: now() })
    return rows.length
  })
}

export async function removeScoreFromProject(projectId, scoreId) {
  await db.transaction('rw', db.projectScores, async () => {
    await db.projectScores.where({ projectId, scoreId }).delete()
    await renumberProject(projectId)
  })
}

/** Re-assign positions 0..n-1 following the given ordered scoreIds. */
export async function reorderProjectScores(projectId, orderedScoreIds) {
  await db.transaction('rw', db.projectScores, async () => {
    const links = await db.projectScores.where('projectId').equals(projectId).toArray()
    const byScore = new Map(links.map((l) => [l.scoreId, l]))
    const updated = []
    let pos = 0
    for (const sid of orderedScoreIds) {
      const l = byScore.get(sid)
      if (!l) continue
      byScore.delete(sid)
      updated.push({ ...l, position: pos++ })
    }
    // anything not mentioned keeps relative order at the end
    for (const l of [...byScore.values()].sort((a, b) => a.position - b.position)) {
      updated.push({ ...l, position: pos++ })
    }
    await db.projectScores.bulkPut(updated)
  })
}

async function renumberProject(projectId) {
  const links = await db.projectScores.where('projectId').equals(projectId).sortBy('position')
  const fixed = links.map((l, i) => ({ ...l, position: i }))
  if (fixed.length) await db.projectScores.bulkPut(fixed)
}

export async function getProjectsForScore(scoreId) {
  const links = await db.projectScores.where('scoreId').equals(scoreId).toArray()
  const projects = await db.projects.bulkGet(links.map((l) => l.projectId))
  return projects.filter(Boolean)
}

export async function countScoresInProjects() {
  const links = await db.projectScores.toArray()
  const counts = new Map()
  for (const l of links) counts.set(l.projectId, (counts.get(l.projectId) || 0) + 1)
  return counts
}

// ── Settings ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  penOnly: false, // only accept Apple Pencil / stylus input when drawing
  keepAwake: true, // request a screen wake lock while viewing
  fitMode: 'page', // 'page' | 'width'
  enhanceScans: true, // grayscale + contrast for camera captures
  penColor: '#1d4ed8',
  penWidth: 1.6,
  highlighterColor: '#facc15',
  highlighterWidth: 12,
  textColor: '#b91c1c',
  textSize: 12,
  tapToTurn: true,
}

export async function getSetting(key, fallback = DEFAULT_SETTINGS[key]) {
  const r = await db.settings.get(key)
  return r === undefined ? fallback : r.value
}

export function setSetting(key, value) {
  return db.settings.put({ key, value })
}

// ── Maintenance ─────────────────────────────────────────────────────────────

/** Wipe every table but keep the database open (live queries keep working). */
export async function clearAllData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

export const TABLE_NAMES = ['scores', 'files', 'annotations', 'projects', 'projectScores', 'settings']
