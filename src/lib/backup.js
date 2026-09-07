// Backup & restore: the whole library as one zip file.
//
// Archive layout (format 1)
//   manifest.json                { app:'notstall', format, schemaVersion, exportedAt, counts, skipped }
//   tables/scores.json           score records WITHOUT the thumb buffer (see thumbs/)
//   tables/files.json            file metadata { id, mime, size, name } – bytes live in files/
//   tables/annotations.json
//   tables/projects.json
//   tables/projectScores.json
//   tables/settings.json
//   files/<scoreId>.pdf          raw PDF bytes, stored (level 0 – PDFs barely compress)
//   thumbs/<scoreId>.jpg         cached thumbnail, stored (level 0). Optional: a missing
//                                thumbnail is re-rendered in the background after import.
//
// Cloud bookkeeping (ownerId, dirty, remote*/cloud* versions, the tombstones
// table) is never part of an archive: a restored row is a fresh device-only row
// (ownerId null, dirty 1) that the account flow can adopt and upload later.
//
// The archive is produced with fflate's streaming `Zip` so each PDF is read from
// IndexedDB and appended one at a time; the output is collected as chunks into a
// Blob, keeping peak memory close to the size of the library (an in-memory
// `zip()` call would need roughly twice that, which matters on an iPad).
import { Zip, ZipDeflate, ZipPassThrough, unzipSync, strToU8, strFromU8 } from 'fflate'
import { db, TABLE_NAMES, updateScore } from '../db/db.js'

export const BACKUP_APP = 'notstall'
export const BACKUP_FORMAT = 1
export const BACKUP_MIME = 'application/zip'

/** Small pause so the UI can paint progress between heavy steps. */
const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

function jsonBytes(value) {
  return strToU8(JSON.stringify(value))
}

/** Drop sync bookkeeping (ownerId, dirty and the remote…/cloud… version fields) from a row. */
export function stripSyncFields(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'ownerId' || k === 'dirty' || k.startsWith('remote') || k.startsWith('cloud')) continue
    out[k] = v
  }
  return out
}

/** Give every entry the export time as its modification date. */
function stamp(file, date) {
  file.mtime = date
  return file
}

/**
 * Export every table and file as a zip Blob.
 * @param {{ onProgress?: (p: { done: number, total: number, label: string }) => void }} [opts]
 * @returns {Promise<{ blob: Blob, counts: object, skipped: string[] }>}
 */
export async function exportBackup({ onProgress } = {}) {
  // Read tables OUTSIDE any transaction (keeps the transaction short and avoids
  // mixing non-Dexie awaits into it).
  const [scores, annotations, projects, projectScores, settings] = await Promise.all([
    db.scores.toArray(),
    db.annotations.toArray(),
    db.projects.toArray(),
    db.projectScores.toArray(),
    db.settings.toArray(),
  ])

  const exportedAt = new Date()
  const chunks = []
  let failure = null
  const zipper = new Zip((err, chunk) => {
    if (err) failure = err
    else if (chunk?.length) chunks.push(chunk)
  })
  const addEntry = (name, bytes, { level = 6 } = {}) => {
    const entry = level === 0 ? new ZipPassThrough(name) : new ZipDeflate(name, { level })
    stamp(entry, exportedAt)
    zipper.add(entry)
    entry.push(bytes, true)
    if (failure) throw failure
  }

  const total = scores.length + 1
  let done = 0
  const report = (label) => onProgress?.({ done, total, label })
  report('Förbereder…')

  const scoreRecords = []
  const fileMeta = []
  const skipped = []
  let thumbs = 0
  for (const score of scores) {
    const file = await db.files.get(score.id)
    if (!file?.data || !(file.data instanceof ArrayBuffer) || file.data.byteLength === 0) {
      // A score without its PDF cannot be restored; leave it out and tell the user.
      skipped.push(score.title || score.id)
      done++
      continue
    }
    const { thumb, ...rest } = score
    scoreRecords.push(stripSyncFields(rest))
    fileMeta.push({ id: score.id, mime: file.mime || 'application/pdf', size: file.data.byteLength, name: file.name || '' })
    addEntry(`files/${score.id}.pdf`, new Uint8Array(file.data), { level: 0 })
    if (thumb instanceof ArrayBuffer && thumb.byteLength) {
      addEntry(`thumbs/${score.id}.jpg`, new Uint8Array(thumb), { level: 0 })
      thumbs++
    }
    done++
    report(score.title || 'Stycke')
    await yieldToUi()
  }

  const kept = new Set(scoreRecords.map((s) => s.id))
  const annotationRecords = annotations.filter((a) => kept.has(a.scoreId)).map(stripSyncFields)
  const projectRecords = projects.map(stripSyncFields)
  const linkRecords = projectScores.map(stripSyncFields)
  const counts = {
    scores: scoreRecords.length,
    files: fileMeta.length,
    thumbs,
    annotations: annotationRecords.length,
    projects: projects.length,
    projectScores: projectScores.length,
    settings: settings.length,
  }
  const manifest = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: db.verno,
    exportedAt: exportedAt.toISOString(),
    counts,
    skipped,
  }
  addEntry('manifest.json', jsonBytes(manifest))
  addEntry('tables/scores.json', jsonBytes(scoreRecords))
  addEntry('tables/files.json', jsonBytes(fileMeta))
  addEntry('tables/annotations.json', jsonBytes(annotationRecords))
  addEntry('tables/projects.json', jsonBytes(projectRecords))
  addEntry('tables/projectScores.json', jsonBytes(linkRecords))
  addEntry('tables/settings.json', jsonBytes(settings))
  zipper.end()
  if (failure) throw failure
  done = total
  report('Klar')

  return { blob: new Blob(chunks, { type: BACKUP_MIME }), counts, skipped }
}

/** File name for a fresh backup, e.g. notstall-backup-2026-09-05.zip */
export function backupFileName(iso) {
  return `notstall-backup-${iso}.zip`
}

// ── Reading archives ────────────────────────────────────────────────────────

function invalid(message) {
  const err = new Error(message)
  err.code = 'INVALID_BACKUP'
  return err
}

async function fileToU8(file) {
  const buf = await (file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer())
  return new Uint8Array(buf)
}

/**
 * Standalone ArrayBuffer for an unzipped entry. fflate already hands back a private
 * copy per entry (both stored and deflated), so the bytes can be used as-is; only a
 * view into a larger buffer needs copying.
 */
function ownBuffer(u8) {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength ? u8.buffer : u8.slice().buffer
}

function unzipOrThrow(u8, opts) {
  try {
    return unzipSync(u8, opts)
  } catch {
    throw invalid('Filen kunde inte läsas som en zip-fil.')
  }
}

function parseJsonEntry(entries, name, fallback) {
  const u8 = entries[name]
  if (!u8) return fallback
  try {
    return JSON.parse(strFromU8(u8))
  } catch {
    throw invalid(`Säkerhetskopian är skadad (${name}).`)
  }
}

function parseManifest(entries) {
  const manifest = parseJsonEntry(entries, 'manifest.json', null)
  if (!manifest || typeof manifest !== 'object') throw invalid('Filen är inte en säkerhetskopia från Notställ (manifest saknas).')
  if (manifest.app !== BACKUP_APP) throw invalid('Filen är inte en säkerhetskopia från Notställ.')
  if (Number(manifest.format || 1) > BACKUP_FORMAT) throw invalid('Säkerhetskopian kommer från en nyare version av Notställ. Uppdatera appen och försök igen.')
  return manifest
}

/**
 * Read only the manifest of a backup (cheap: other entries are not inflated).
 * @returns {Promise<{ manifest: object, counts: { scores:number, projects:number, annotations:number }, exportedAt: string }>}
 */
export async function readBackupManifest(file) {
  const u8 = await fileToU8(file)
  const entries = unzipOrThrow(u8, { filter: (f) => f.name === 'manifest.json' })
  const manifest = parseManifest(entries)
  const c = manifest.counts || {}
  return {
    manifest,
    exportedAt: manifest.exportedAt || '',
    counts: {
      scores: Number(c.scores) || 0,
      projects: Number(c.projects) || 0,
      annotations: Number(c.annotations) || 0,
    },
  }
}

const asArray = (v) => (Array.isArray(v) ? v : [])
const isRecord = (v) => v && typeof v === 'object' && typeof v.id === 'string' && v.id.length > 0

/**
 * Make a stored score record whole again (fills fields older exports may lack).
 * The result is a device-only row: no owner, dirty, nothing uploaded yet.
 */
function normalizeScore(input, fileSize, thumb) {
  const raw = stripSyncFields(input)
  const pageCount = Number.isInteger(raw.pageCount) && raw.pageCount > 0 ? raw.pageCount : Math.max(1, asArray(raw.pageOrder).length)
  const pageOrder = asArray(raw.pageOrder).filter((n) => Number.isInteger(n) && n >= 0 && n < pageCount)
  const t = Date.now()
  return {
    ...raw,
    ownerId: null,
    dirty: 1,
    fileVersion: Math.max(1, Number(raw.fileVersion) || 1),
    remoteFileVersion: 0,
    thumbVersion: thumb ? Math.max(1, Number(raw.thumbVersion) || 1) : 0,
    remoteThumbVersion: 0,
    title: String(raw.title || '').trim() || 'Namnlöst stycke',
    composer: String(raw.composer || ''),
    voice: String(raw.voice || ''),
    key: String(raw.key || ''),
    notes: String(raw.notes || ''),
    pageCount,
    fileSize,
    pageOrder: pageOrder.length ? pageOrder : Array.from({ length: pageCount }, (_, i) => i),
    rotations: raw.rotations && typeof raw.rotations === 'object' ? raw.rotations : {},
    thumb,
    thumbMime: raw.thumbMime || 'image/jpeg',
    createdAt: Number(raw.createdAt) || t,
    updatedAt: Number(raw.updatedAt) || t,
    lastOpenedAt: Number(raw.lastOpenedAt) || 0,
  }
}

/**
 * Restore a backup.
 * @param {File|Blob} file
 * @param {'merge'|'replace'} mode  merge = keep existing records (same ids are overwritten,
 *                                  local settings and setlist entries are kept),
 *                                  replace = wipe every table first
 * @returns {Promise<{ scores:number, projects:number, annotations:number, skipped:string[], scoreIds:string[] }>}
 */
export async function importBackup(file, mode = 'merge') {
  if (mode !== 'merge' && mode !== 'replace') throw new Error(`Okänt importläge: ${mode}`)
  // Every entry comes back as its own copy, so the zip bytes are garbage as soon
  // as unzipSync returns – do not keep a reference to them.
  const entries = unzipOrThrow(await fileToU8(file))
  parseManifest(entries)

  const rawScores = asArray(parseJsonEntry(entries, 'tables/scores.json', [])).filter(isRecord)
  const fileMeta = new Map(asArray(parseJsonEntry(entries, 'tables/files.json', [])).filter(isRecord).map((f) => [f.id, f]))
  const rawAnnotations = asArray(parseJsonEntry(entries, 'tables/annotations.json', []))
  const rawProjects = asArray(parseJsonEntry(entries, 'tables/projects.json', [])).filter(isRecord)
  const rawLinks = asArray(parseJsonEntry(entries, 'tables/projectScores.json', [])).filter(isRecord)
  const rawSettings = asArray(parseJsonEntry(entries, 'tables/settings.json', [])).filter((s) => s && typeof s.key === 'string')

  // Build every record BEFORE the transaction: nothing but Dexie work happens inside it.
  const scores = []
  const files = []
  const skipped = []
  const needThumb = []
  for (const raw of rawScores) {
    const pdf = entries[`files/${raw.id}.pdf`]
    if (!pdf || pdf.length === 0) {
      skipped.push(raw.title || raw.id)
      continue
    }
    const data = ownBuffer(pdf)
    const thumbU8 = entries[`thumbs/${raw.id}.jpg`]
    const thumb = thumbU8 && thumbU8.length ? ownBuffer(thumbU8) : null
    if (!thumb) needThumb.push(raw.id)
    const meta = fileMeta.get(raw.id)
    const score = normalizeScore(raw, data.byteLength, thumb)
    scores.push(score)
    files.push({ id: raw.id, data, mime: meta?.mime || 'application/pdf', size: data.byteLength, name: meta?.name || '', version: score.fileVersion })
  }
  const importedIds = new Set(scores.map((s) => s.id))
  const now = Date.now()
  const annotations = rawAnnotations
    .filter((a) => a && typeof a.scoreId === 'string' && Number.isInteger(a.pageIndex) && importedIds.has(a.scoreId))
    .map((a) => ({ ...stripSyncFields(a), strokes: asArray(a.strokes), texts: asArray(a.texts), note: String(a.note || ''), updatedAt: Number(a.updatedAt) || now, dirty: 1 }))
  const projects = rawProjects.map((p) => ({
    ...stripSyncFields(p),
    name: String(p.name || '').trim() || 'Namnlöst projekt',
    date: typeof p.date === 'string' ? p.date : '',
    venue: String(p.venue || ''),
    notes: String(p.notes || ''),
    createdAt: Number(p.createdAt) || now,
    updatedAt: Number(p.updatedAt) || now,
    ownerId: null,
    dirty: 1,
  }))
  const projectIds = new Set(projects.map((p) => p.id))
  const links = rawLinks
    .filter((l) => typeof l.projectId === 'string' && typeof l.scoreId === 'string' && projectIds.has(l.projectId))
    .map((l) => ({ ...stripSyncFields(l), position: Number(l.position) || 0, updatedAt: Number(l.updatedAt) || now, ownerId: null, dirty: 1 }))
  const settings = rawSettings.map((s) => ({ key: s.key, value: s.value }))

  // Only the content tables take part – tombstones (pending cloud deletions) are
  // never restored from, nor wiped by, a backup.
  const tables = TABLE_NAMES.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const t of tables) await t.clear()
    }
    // In merge mode a link may point at a score that already lives here even if the
    // archive skipped it; keep those, drop links to scores that exist nowhere.
    let known = importedIds
    let validLinks = links
    let importSettings = settings
    const touchedProjects = new Set()
    if (mode === 'merge') {
      const existing = await db.scores.toCollection().primaryKeys()
      known = new Set([...importedIds, ...existing])
      validLinks = validLinks.filter((l) => known.has(l.scoreId))
      // A project may already hold the same score under another link id (the score
      // was removed and re-added after the backup was taken). Keep the local entry
      // and append new ones after it – duplicates cannot be repaired from the UI.
      if (validLinks.length) {
        const pids = [...new Set(validLinks.map((l) => l.projectId))]
        const local = await db.projectScores.where('projectId').anyOf(pids).toArray()
        const archiveIds = new Set(validLinks.map((l) => l.id))
        const pairKey = (l) => `${l.projectId}\u0000${l.scoreId}`
        const taken = new Set(local.filter((l) => !archiveIds.has(l.id)).map(pairKey))
        const localIds = new Set(local.map((l) => l.id))
        const nextPos = new Map()
        for (const l of local) nextPos.set(l.projectId, Math.max(nextPos.get(l.projectId) ?? -1, l.position) + 1)
        validLinks = validLinks
          .filter((l) => {
            const k = pairKey(l)
            if (taken.has(k)) return false
            taken.add(k)
            return true
          })
          .map((l) => {
            touchedProjects.add(l.projectId)
            const base = nextPos.get(l.projectId) ?? 0
            return localIds.has(l.id) ? l : { ...l, position: base + (Number(l.position) || 0) }
          })
      }
      // "Behåller allt du har nu": settings already chosen on this device win.
      const localKeys = new Set(await db.settings.toCollection().primaryKeys())
      importSettings = settings.filter((s) => !localKeys.has(s.key))
    } else {
      validLinks = validLinks.filter((l) => known.has(l.scoreId))
    }
    if (scores.length) await db.scores.bulkPut(scores)
    if (files.length) await db.files.bulkPut(files)
    if (annotations.length) await db.annotations.bulkPut(annotations)
    if (projects.length) await db.projects.bulkPut(projects)
    if (validLinks.length) await db.projectScores.bulkPut(validLinks)
    if (importSettings.length) await db.settings.bulkPut(importSettings)
    // Compact positions to 0..n-1 in every project that received merged links.
    // Moved rows are marked dirty so an owned setlist re-syncs its new order.
    for (const pid of touchedProjects) {
      const rows = await db.projectScores.where('projectId').equals(pid).sortBy('position')
      const moved = rows.filter((l, i) => l.position !== i).map((l) => ({ ...l, position: rows.indexOf(l), updatedAt: now, dirty: 1 }))
      if (moved.length) await db.projectScores.bulkPut(moved)
    }
  })

  // Best effort, in the background: render thumbnails the archive did not carry.
  if (needThumb.length) regenerateThumbnails(needThumb).catch(() => {})

  return { scores: scores.length, projects: projects.length, annotations: annotations.length, skipped, scoreIds: [...importedIds] }
}

async function regenerateThumbnails(ids) {
  // Loaded on demand so the settings page does not pull pdf.js in eagerly.
  const { makeThumbnailFromBytes } = await import('./importScore.js')
  for (const id of ids) {
    const [score, file] = await Promise.all([db.scores.get(id), db.files.get(id)])
    if (!score || !file?.data || score.thumb) continue
    const first = score.pageOrder?.[0] ?? 0
    const thumb = await makeThumbnailFromBytes(file.data, { pageIndex: first, rotation: score.rotations?.[first] || 0 })
    if (thumb) await updateScore(id, { thumb })
  }
}
