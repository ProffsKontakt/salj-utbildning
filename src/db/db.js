// ─────────────────────────────────────────────────────────────────────────────
// Notställ – local-first storage layer (Dexie / IndexedDB)
//
// Tables
//   scores        { id, title, composer, voice, key, notes, pageCount, fileSize,
//                   pageOrder:number[], rotations:{[srcPage]:0|90|180|270},
//                   thumb:ArrayBuffer|null, thumbMime, createdAt, updatedAt, lastOpenedAt,
//                   ownerId:string|null, dirty:0|1,
//                   fileVersion, remoteFileVersion, thumbVersion, remoteThumbVersion }
//   files         { id (= scoreId), data:ArrayBuffer (PDF bytes), mime, size, name, version }
//                 A files row exists only for scores that are available offline ("nedladdade").
//   annotations   { scoreId, pageIndex, strokes:Stroke[], texts:TextNote[], note, updatedAt, dirty }
//                   Stroke   = { id, tool:'pen'|'highlighter', color:'#rrggbb', width:pt, opacity:0..1,
//                                points:number[] (flat x0,y0,x1,y1,… in PDF user space) }
//                   TextNote = { id, x, y, text, color:'#rrggbb', size:pt }   (PDF user space, baseline-left)
//   projects      { id, name, date:'YYYY-MM-DD'|'', venue, notes, createdAt, updatedAt, ownerId, dirty }
//   projectScores { id, projectId, scoreId, position, updatedAt, ownerId, dirty }
//   settings      { key, value }
//   tombstones    { id (auto), table, key, ownerId, deletedAt }   deletions waiting to be pushed
//
// Sync model: `ownerId` is the account a row belongs to (null = only on this
// device). Every local write sets `dirty = 1`; the sync engine pushes dirty
// rows of the signed-in owner, then clears the flag. Deleting an owned row
// leaves a tombstone so other devices remove their copy. Rows coming *from* the
// cloud are written through the helpers in src/lib/sync/apply.js, which never
// set dirty or tombstones.
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
// v3: cloud sync – ownership, dirty flags, file/thumb versions, tombstones.
db.version(3)
  .stores({
    scores: 'id, title, composer, updatedAt, createdAt, lastOpenedAt, dirty, ownerId',
    files: 'id',
    annotations: '[scoreId+pageIndex], scoreId, dirty',
    projects: 'id, name, date, updatedAt, dirty, ownerId',
    projectScores: 'id, projectId, scoreId, [projectId+position], [projectId+scoreId], dirty, ownerId',
    settings: 'key',
    tombstones: '++id, table, ownerId',
  })
  .upgrade(async (tx) => {
    const t = Date.now()
    await tx
      .table('scores')
      .toCollection()
      .modify((s) => {
        s.ownerId ??= null
        s.dirty ??= 1
        s.fileVersion ??= 1
        s.remoteFileVersion ??= 0
        s.thumbVersion ??= s.thumb ? 1 : 0
        s.remoteThumbVersion ??= 0
      })
    await tx
      .table('files')
      .toCollection()
      .modify((f) => {
        f.version ??= 1
      })
    await tx
      .table('annotations')
      .toCollection()
      .modify((a) => {
        a.dirty ??= 1
      })
    await tx
      .table('projects')
      .toCollection()
      .modify((p) => {
        p.ownerId ??= null
        p.dirty ??= 1
      })
    await tx
      .table('projectScores')
      .toCollection()
      .modify((l) => {
        l.ownerId ??= null
        l.dirty ??= 1
        l.updatedAt ??= t
      })
  })

export const now = () => Date.now()

export const ROTATIONS = [0, 90, 180, 270]

export function normalizeRotation(deg) {
  const r = ((Math.round(deg / 90) * 90) % 360 + 360) % 360
  return r
}

// ── Sync context ────────────────────────────────────────────────────────────
// The signed-in account id. New rows are created for this owner and deletions
// of owned rows leave tombstones. Set by the auth layer; null when signed out.
let syncUserId = null
export function setSyncUserId(id) {
  syncUserId = id || null
}
export function getSyncUserId() {
  return syncUserId
}

/** Emits 'dirty' whenever a local write happens (the sync engine debounces on it). */
export const dbEvents = new EventTarget()
function emitDirty(table) {
  try {
    dbEvents.dispatchEvent(new CustomEvent('dirty', { detail: { table } }))
  } catch {
    /* ignore */
  }
}

async function addTombstone(table, key, ownerId) {
  if (!ownerId) return
  await db.tombstones.add({ table, key, ownerId, deletedAt: now() })
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
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('PDF-filen innehåller inga sidor.')
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
    ownerId: syncUserId,
    dirty: 1,
    fileVersion: 1,
    remoteFileVersion: 0,
    thumbVersion: thumb ? 1 : 0,
    remoteThumbVersion: 0,
  }
  await db.transaction('rw', db.scores, db.files, db.projectScores, db.projects, async () => {
    await db.scores.add(score)
    await db.files.add({ id, data: pdfBytes, mime: 'application/pdf', size: pdfBytes.byteLength, name: fileName, version: 1 })
    if (projectId) await addScoresToProject(projectId, [id])
  })
  emitDirty('scores')
  return score
}

export function getScore(id) {
  return db.scores.get(id)
}

export function getScoreFile(id) {
  return db.files.get(id)
}

/** True when the PDF bytes are stored on this device. */
export async function isDownloaded(id) {
  return (await db.files.where('id').equals(id).count()) > 0
}

export async function updateScore(id, patch) {
  const clean = { ...patch }
  delete clean.id
  delete clean.ownerId
  delete clean.dirty
  const t = now()
  const n = await db.scores
    .where('id')
    .equals(id)
    .modify((s) => {
      Object.assign(s, clean)
      if ('thumb' in clean) s.thumbVersion = (s.thumbVersion || 0) + 1
      s.updatedAt = t
      s.dirty = 1
    })
  if (n) emitDirty('scores')
  return n
}

/** Local-only bookkeeping – does not mark the row dirty. */
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
    const score = await db.scores.get(id)
    if (!score) throw new Error('Stycket finns inte längre.')
    const file = await db.files.get(id)
    const fileVersion = (score.fileVersion || 0) + 1
    await db.files.put({
      id,
      data: pdfBytes,
      mime: 'application/pdf',
      size: pdfBytes.byteLength,
      name: file?.name || '',
      version: fileVersion,
    })
    await db.scores
      .where('id')
      .equals(id)
      .modify((s) => {
        s.pageCount = pageCount
        s.fileSize = pdfBytes.byteLength
        s.fileVersion = fileVersion
        if (pageOrder) s.pageOrder = pageOrder
        if (rotations) s.rotations = rotations
        if (thumb !== undefined) {
          s.thumb = thumb
          s.thumbVersion = (s.thumbVersion || 0) + 1
        }
        s.updatedAt = now()
        s.dirty = 1
      })
  })
  emitDirty('scores')
}

/** Store downloaded PDF bytes for a cloud score (does not mark anything dirty). */
export async function storeDownloadedFile(id, pdfBytes, version) {
  await db.transaction('rw', db.scores, db.files, async () => {
    const score = await db.scores.get(id)
    if (!score) return
    await db.files.put({ id, data: pdfBytes, mime: 'application/pdf', size: pdfBytes.byteLength, name: '', version })
    await db.scores.update(id, { remoteFileVersion: version, fileVersion: version, fileSize: pdfBytes.byteLength })
  })
}

/** Remove the offline copy of a score (the cloud copy stays). */
export async function removeDownload(id) {
  await db.files.delete(id)
}

export async function deleteScore(id) {
  await db.transaction('rw', db.scores, db.files, db.annotations, db.projectScores, db.tombstones, async () => {
    const score = await db.scores.get(id)
    await db.scores.delete(id)
    await db.files.delete(id)
    await db.annotations.where('scoreId').equals(id).delete()
    const links = await db.projectScores.where('scoreId').equals(id).toArray()
    await db.projectScores.bulkDelete(links.map((l) => l.id))
    if (score?.ownerId) {
      await addTombstone('scores', id, score.ownerId)
      for (const l of links) if (l.ownerId) await addTombstone('projectScores', l.id, l.ownerId)
    }
    // keep positions contiguous in affected projects
    const projectIds = [...new Set(links.map((l) => l.projectId))]
    for (const pid of projectIds) await renumberProject(pid)
  })
  emitDirty('scores')
}

export async function deleteScores(ids) {
  for (const id of ids) await deleteScore(id)
}

/** Total PDF bytes stored on this device (downloaded scores only). */
export async function totalFileBytes() {
  const ids = await db.files.toCollection().primaryKeys()
  if (!ids.length) return 0
  const scores = await db.scores.bulkGet(ids)
  return scores.reduce((sum, s) => sum + (s?.fileSize || 0), 0)
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
  let rec = null
  await db.transaction('rw', db.annotations, db.scores, db.tombstones, async () => {
    if (isEmpty) {
      const existed = await db.annotations.get([scoreId, pageIndex])
      await db.annotations.delete([scoreId, pageIndex])
      if (existed) {
        const score = await db.scores.get(scoreId)
        await addTombstone('annotations', { scoreId, pageIndex }, score?.ownerId)
      }
      return
    }
    rec = { scoreId, pageIndex, v: 1, strokes, texts, note, updatedAt: now(), dirty: 1 }
    await db.annotations.put(rec)
  })
  emitDirty('annotations')
  return rec
}

export async function clearAnnotationsForScore(scoreId) {
  await db.transaction('rw', db.annotations, db.scores, db.tombstones, async () => {
    const score = await db.scores.get(scoreId)
    const existing = await db.annotations.where('scoreId').equals(scoreId).toArray()
    await db.annotations.where('scoreId').equals(scoreId).delete()
    for (const a of existing) await addTombstone('annotations', { scoreId, pageIndex: a.pageIndex }, score?.ownerId)
  })
  emitDirty('annotations')
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
    ownerId: syncUserId,
    dirty: 1,
  }
  await db.projects.add(project)
  emitDirty('projects')
  return project
}

export function getProject(id) {
  return db.projects.get(id)
}

export async function updateProject(id, patch) {
  const clean = { ...patch }
  delete clean.id
  delete clean.ownerId
  delete clean.dirty
  const n = await db.projects.update(id, { ...clean, updatedAt: now(), dirty: 1 })
  if (n) emitDirty('projects')
  return n
}

export async function deleteProject(id) {
  await db.transaction('rw', db.projects, db.projectScores, db.tombstones, async () => {
    const project = await db.projects.get(id)
    const links = await db.projectScores.where('projectId').equals(id).toArray()
    await db.projects.delete(id)
    await db.projectScores.where('projectId').equals(id).delete()
    if (project?.ownerId) {
      await addTombstone('projects', id, project.ownerId)
      for (const l of links) if (l.ownerId) await addTombstone('projectScores', l.id, l.ownerId)
    }
  })
  emitDirty('projects')
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
  const added = await db.transaction('rw', db.projectScores, db.projects, async () => {
    const project = await db.projects.get(projectId)
    const existing = await db.projectScores.where('projectId').equals(projectId).toArray()
    const have = new Set(existing.map((l) => l.scoreId))
    let pos = existing.length ? Math.max(...existing.map((l) => l.position)) + 1 : 0
    const rows = []
    const t = now()
    for (const scoreId of scoreIds) {
      if (have.has(scoreId)) continue
      have.add(scoreId)
      rows.push({ id: uid(), projectId, scoreId, position: pos++, updatedAt: t, ownerId: project?.ownerId ?? syncUserId, dirty: 1 })
    }
    if (rows.length) await db.projectScores.bulkAdd(rows)
    await db.projects.update(projectId, { updatedAt: t, dirty: 1 })
    return rows.length
  })
  emitDirty('projectScores')
  return added
}

export async function removeScoreFromProject(projectId, scoreId) {
  await db.transaction('rw', db.projectScores, db.tombstones, async () => {
    const links = await db.projectScores.where({ projectId, scoreId }).toArray()
    await db.projectScores.where({ projectId, scoreId }).delete()
    for (const l of links) await addTombstone('projectScores', l.id, l.ownerId)
    await renumberProject(projectId)
  })
  emitDirty('projectScores')
}

/** Re-assign positions 0..n-1 following the given ordered scoreIds. */
export async function reorderProjectScores(projectId, orderedScoreIds) {
  await db.transaction('rw', db.projectScores, async () => {
    const links = await db.projectScores.where('projectId').equals(projectId).toArray()
    const byScore = new Map(links.map((l) => [l.scoreId, l]))
    const updated = []
    const t = now()
    let pos = 0
    for (const sid of orderedScoreIds) {
      const l = byScore.get(sid)
      if (!l) continue
      byScore.delete(sid)
      updated.push({ ...l, position: pos++, updatedAt: t, dirty: 1 })
    }
    // anything not mentioned keeps relative order at the end
    for (const l of [...byScore.values()].sort((a, b) => a.position - b.position)) {
      updated.push({ ...l, position: pos++, updatedAt: t, dirty: 1 })
    }
    await db.projectScores.bulkPut(updated)
  })
  emitDirty('projectScores')
}

async function renumberProject(projectId) {
  const links = await db.projectScores.where('projectId').equals(projectId).sortBy('position')
  const t = now()
  const fixed = links.filter((l, i) => l.position !== i).map((l) => ({ ...l, position: links.indexOf(l), updatedAt: t, dirty: 1 }))
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
  autoDownload: true, // download cloud scores when opened while online
}

export async function getSetting(key, fallback = DEFAULT_SETTINGS[key]) {
  const r = await db.settings.get(key)
  return r === undefined ? fallback : r.value
}

export function setSetting(key, value) {
  return db.settings.put({ key, value })
}

// ── Account / sync bookkeeping ──────────────────────────────────────────────

/** Rows that were created before signing in (ownerId null). */
export async function countLocalOnly() {
  const [scores, projects] = await Promise.all([
    db.scores.filter((s) => !s.ownerId).count(),
    db.projects.filter((p) => !p.ownerId).count(),
  ])
  return { scores, projects }
}

/** Attach every device-only row to an account so the next sync uploads it. */
export async function adoptLocalLibrary(userId) {
  if (!userId) return 0
  let n = 0
  await db.transaction('rw', db.scores, db.projects, db.projectScores, db.annotations, async () => {
    const owned = (r) => {
      if (r.ownerId) return
      r.ownerId = userId
      r.dirty = 1
      n++
    }
    await db.scores.toCollection().modify(owned)
    await db.projects.toCollection().modify(owned)
    await db.projectScores.toCollection().modify(owned)
    await db.annotations.toCollection().modify((a) => {
      a.dirty = 1
    })
  })
  if (n) emitDirty('adopt')
  return n
}

/** Pending local changes for an owner: dirty rows + tombstones. */
export async function countUnsynced(userId) {
  if (!userId) return 0
  const ownedScoreIds = new Set((await db.scores.where('ownerId').equals(userId).primaryKeys()).map(String))
  const [s, p, l, t, a] = await Promise.all([
    db.scores.where('dirty').equals(1).filter((r) => r.ownerId === userId).count(),
    db.projects.where('dirty').equals(1).filter((r) => r.ownerId === userId).count(),
    db.projectScores.where('dirty').equals(1).filter((r) => r.ownerId === userId).count(),
    db.tombstones.where('ownerId').equals(userId).count(),
    db.annotations.where('dirty').equals(1).filter((r) => ownedScoreIds.has(r.scoreId)).count(),
  ])
  return s + p + l + t + a
}

/**
 * Remove everything that belongs to an account from this device (sign-out or
 * account switch). Device-only rows (ownerId null) are kept.
 */
export async function clearUserData(userId) {
  if (!userId) return
  await db.transaction('rw', db.tables, async () => {
    const scoreIds = await db.scores.where('ownerId').equals(userId).primaryKeys()
    await db.files.bulkDelete(scoreIds)
    for (const id of scoreIds) await db.annotations.where('scoreId').equals(id).delete()
    await db.scores.bulkDelete(scoreIds)
    await db.projectScores.where('ownerId').equals(userId).delete()
    await db.projects.where('ownerId').equals(userId).delete()
    await db.tombstones.where('ownerId').equals(userId).delete()
    const keys = (await db.settings.toCollection().primaryKeys()).filter((k) => String(k).startsWith(`sync:`) && String(k).endsWith(`:${userId}`))
    await db.settings.bulkDelete(keys)
  })
}

/** Drop cached rows of any *other* account (device handed to a new user). */
export async function clearForeignUserData(userId) {
  const others = new Set()
  await db.scores.each((s) => {
    if (s.ownerId && s.ownerId !== userId) others.add(s.ownerId)
  })
  await db.projects.each((p) => {
    if (p.ownerId && p.ownerId !== userId) others.add(p.ownerId)
  })
  for (const other of others) await clearUserData(other)
  return others.size
}

// ── Maintenance ─────────────────────────────────────────────────────────────

/** Wipe every table but keep the database open (live queries keep working). */
export async function clearAllData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

export const TABLE_NAMES = ['scores', 'files', 'annotations', 'projects', 'projectScores', 'settings']
