// Sync engine: pushes local changes (dirty rows, tombstones, PDF/thumbnail
// uploads) to the cloud, pulls remote changes since the last cursor, and
// downloads files for scores kept offline. Last-write-wins per row by the
// client `updatedAt`; rows are applied through applyRemote (never dirty).
import { db, setSyncUserId, dbEvents, getSetting, setSetting, storeDownloadedFile, countUnsynced, removeDownload as dbRemoveDownload } from '../../db/db.js'
import {
  PUSH_ORDER,
  PULL_ORDER,
  toIso,
  toMs,
  scoreToRemote,
  scoreFromRemote,
  projectToRemote,
  projectFromRemote,
  linkToRemote,
  linkFromRemote,
  annotationToRemote,
  annotationFromRemote,
  filePath,
  thumbPath,
} from './mapping.js'

const CURSOR_KEY = (table, uid) => `sync:cursor:${table}:${uid}`
const LAST_KEY = (uid) => `sync:last:${uid}`
const EPOCH = '1970-01-01T00:00:00.000Z'
const OVERLAP_MS = 5000 // re-read a little history: synced_at is a commit-time clock
const PAGE = 500
const CHUNK = 200
const THUMB_CONCURRENCY = 3

async function invalidateDoc(scoreId) {
  try {
    const m = await import('../pdf.js')
    m.invalidateScoreDocument(scoreId)
  } catch {
    /* pdf.js not loaded yet – nothing cached */
  }
}

export function createSyncEngine({ cloud, onStatus }) {
  let user = null
  let running = false
  let queued = false
  let timer = null
  let interval = null
  let started = false
  const downloading = new Set()
  const status = { phase: 'idle', lastSyncAt: 0, error: null, pending: 0, progress: null, downloading: [] }

  const emit = () => onStatus?.({ ...status, downloading: [...downloading] })
  const set = (patch) => {
    Object.assign(status, patch)
    emit()
  }

  async function refreshPending() {
    try {
      status.pending = user ? await countUnsynced(user.id) : 0
    } catch {
      status.pending = 0
    }
    emit()
  }

  function schedule(delay = 1500) {
    if (!user) return
    clearTimeout(timer)
    timer = setTimeout(() => sync('scheduled'), delay)
  }

  const onDirty = () => schedule(1500)
  const onOnline = () => schedule(0)
  const onVisible = () => {
    if (document.visibilityState === 'visible') schedule(0)
  }

  function start() {
    if (started) return
    started = true
    dbEvents.addEventListener('dirty', onDirty)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    interval = setInterval(() => {
      if (document.visibilityState === 'visible') schedule(0)
    }, 60_000)
  }

  function stop() {
    if (!started) return
    started = false
    dbEvents.removeEventListener('dirty', onDirty)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(interval)
    clearTimeout(timer)
  }

  function setUser(u) {
    user = u || null
    setSyncUserId(user?.id || null)
    if (user) {
      const last = 0
      set({ phase: 'idle', error: null, lastSyncAt: last })
      getSetting(LAST_KEY(user.id), 0).then((t) => set({ lastSyncAt: t || 0 }))
      schedule(0)
    } else {
      clearTimeout(timer)
      set({ phase: 'idle', error: null, pending: 0, progress: null, lastSyncAt: 0 })
    }
  }

  // ── Push ──────────────────────────────────────────────────────────────

  async function pushTombstones(uid) {
    const stones = await db.tombstones.where('ownerId').equals(uid).toArray()
    if (!stones.length) return
    const byTable = new Map()
    for (const s of stones) {
      if (!byTable.has(s.table)) byTable.set(s.table, [])
      byTable.get(s.table).push(s)
    }
    // children first so a parent's soft delete never races an orphan update
    for (const table of ['annotations', 'projectScores', 'projects', 'scores']) {
      const list = byTable.get(table)
      if (!list?.length) continue
      await cloud.markDeleted(
        table,
        list.map((s) => ({ key: s.key, deletedAt: toIso(s.deletedAt) })),
      )
      if (table === 'scores') {
        const paths = list.flatMap((s) => [filePath(uid, s.key), thumbPath(uid, s.key)])
        await cloud.removeFiles(paths).catch(() => {})
      }
      await db.tombstones.bulkDelete(list.map((s) => s.id))
    }
  }

  async function dirtyRows(table, uid) {
    if (table === 'annotations') {
      const owned = new Set(await db.scores.where('ownerId').equals(uid).primaryKeys())
      return db.annotations
        .where('dirty')
        .equals(1)
        .filter((a) => owned.has(a.scoreId))
        .toArray()
    }
    return db[table]
      .where('dirty')
      .equals(1)
      .filter((r) => r.ownerId === uid)
      .toArray()
  }

  async function pushDirty(uid) {
    for (const table of PUSH_ORDER) {
      const rows = await dirtyRows(table, uid)
      if (!rows.length) continue
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK)
        set({ progress: { kind: 'push', table, done: i, total: rows.length } })
        const prepared = []
        for (const local of batch) {
          if (table === 'scores') {
            let fileVersion = null
            let thumbVersion = null
            const file = await db.files.get(local.id)
            if (file && (local.fileVersion || 0) > (local.remoteFileVersion || 0)) {
              await cloud.uploadFile(filePath(uid, local.id), file.data, 'application/pdf')
              fileVersion = local.fileVersion
            } else if (!local.remoteFileVersion && !file) {
              fileVersion = 0 // never uploaded and nothing to upload (should not happen)
            }
            if (local.thumb && (local.thumbVersion || 0) > (local.remoteThumbVersion || 0)) {
              await cloud.uploadFile(thumbPath(uid, local.id), local.thumb, 'image/jpeg')
              thumbVersion = local.thumbVersion
            }
            prepared.push({ local, remote: scoreToRemote(local, uid, { fileVersion, thumbVersion }), fileVersion, thumbVersion })
          } else if (table === 'projects') prepared.push({ local, remote: projectToRemote(local, uid) })
          else if (table === 'projectScores') prepared.push({ local, remote: linkToRemote(local, uid) })
          else prepared.push({ local, remote: annotationToRemote(local, uid) })
        }
        const returned = await cloud.upsert(
          table,
          prepared.map((p) => p.remote),
        )
        const syncedById = new Map(returned.map((r) => [table === 'annotations' ? `${r.score_id}:${r.page_index}` : r.id, r]))
        // Clear dirty only when the row was not modified while we were uploading.
        for (const p of prepared) {
          const key = table === 'annotations' ? [p.local.scoreId, p.local.pageIndex] : p.local.id
          const r = syncedById.get(table === 'annotations' ? `${p.local.scoreId}:${p.local.pageIndex}` : p.local.id)
          await db[table]
            .where(table === 'annotations' ? '[scoreId+pageIndex]' : 'id')
            .equals(key)
            .modify((row) => {
              if (row.updatedAt === p.local.updatedAt) row.dirty = 0
              if (table === 'scores') {
                if (p.fileVersion != null && p.fileVersion > 0) row.remoteFileVersion = p.fileVersion
                if (p.thumbVersion != null) row.remoteThumbVersion = p.thumbVersion
                if (r) {
                  row.cloudFileVersion = r.file_version ?? row.cloudFileVersion ?? 0
                  row.cloudThumbVersion = r.thumb_version ?? row.cloudThumbVersion ?? 0
                }
              }
            })
        }
      }
    }
    set({ progress: null })
  }

  // ── Pull ──────────────────────────────────────────────────────────────

  async function applyRemote(table, r, uid) {
    if (r.user_id && r.user_id !== uid) return
    const deletedAt = r.deleted_at ? toMs(r.deleted_at) : 0
    const remoteUpdated = toMs(r.updated_at)

    if (table === 'scores') {
      await db.transaction('rw', db.scores, db.files, db.annotations, db.projectScores, async () => {
        const local = await db.scores.get(r.id)
        if (deletedAt) {
          if (local && !(local.dirty && local.updatedAt > deletedAt)) {
            await db.scores.delete(r.id)
            await db.files.delete(r.id)
            await db.annotations.where('scoreId').equals(r.id).delete()
            await db.projectScores.where('scoreId').equals(r.id).delete()
          }
          return
        }
        if (local?.dirty && local.updatedAt >= remoteUpdated) {
          // Local edits win; just remember what the cloud holds for file/thumb refreshes.
          await db.scores.update(r.id, { cloudFileVersion: r.file_version ?? 0, cloudThumbVersion: r.thumb_version ?? 0 })
          return
        }
        const next = scoreFromRemote(r, local)
        next.cloudFileVersion = r.file_version ?? 0
        next.cloudThumbVersion = r.thumb_version ?? 0
        if (!local) {
          // Cloud-only until the user downloads it.
          next.fileVersion = r.file_version ?? 0
          next.remoteFileVersion = r.file_version ?? 0
          next.thumbVersion = 0
          next.remoteThumbVersion = 0
        }
        await db.scores.put(next)
      })
      if (deletedAt) await invalidateDoc(r.id)
      return
    }

    if (table === 'projects') {
      await db.transaction('rw', db.projects, db.projectScores, async () => {
        const local = await db.projects.get(r.id)
        if (deletedAt) {
          if (local && !(local.dirty && local.updatedAt > deletedAt)) {
            await db.projects.delete(r.id)
            await db.projectScores.where('projectId').equals(r.id).delete()
          }
          return
        }
        if (local?.dirty && local.updatedAt >= remoteUpdated) return
        await db.projects.put(projectFromRemote(r, local))
      })
      return
    }

    if (table === 'projectScores') {
      await db.transaction('rw', db.projectScores, db.projects, db.scores, async () => {
        const local = await db.projectScores.get(r.id)
        if (deletedAt) {
          if (local && !(local.dirty && local.updatedAt > deletedAt)) await db.projectScores.delete(r.id)
          return
        }
        if (local?.dirty && local.updatedAt >= remoteUpdated) return
        // Skip links whose project or score is unknown here (deleted locally, tombstone pending).
        const [project, score] = await Promise.all([db.projects.get(r.project_id), db.scores.get(r.score_id)])
        if (!project || !score) return
        await db.projectScores.put(linkFromRemote(r))
      })
      return
    }

    if (table === 'annotations') {
      await db.transaction('rw', db.annotations, db.scores, async () => {
        const key = [r.score_id, r.page_index]
        const local = await db.annotations.get(key)
        if (deletedAt) {
          if (local && !(local.dirty && local.updatedAt > deletedAt)) await db.annotations.delete(key)
          return
        }
        if (local?.dirty && local.updatedAt >= remoteUpdated) return
        if (!(await db.scores.get(r.score_id))) return
        await db.annotations.put(annotationFromRemote(r))
      })
    }
  }

  async function pullAll(uid) {
    for (const table of PULL_ORDER) {
      const cursor = await getSetting(CURSOR_KEY(table, uid), null)
      const since = cursor ? toIso(toMs(cursor) - OVERLAP_MS) : EPOCH
      let offset = 0
      let maxSynced = cursor
      let total = 0
      for (;;) {
        const rows = await cloud.pull(table, { since, offset, limit: PAGE })
        for (const r of rows) {
          await applyRemote(table, r, uid)
          if (!maxSynced || r.synced_at > maxSynced) maxSynced = r.synced_at
        }
        total += rows.length
        set({ progress: { kind: 'pull', table, done: total, total: null } })
        if (rows.length < PAGE) break
        offset += rows.length
      }
      if (maxSynced && maxSynced !== cursor) await setSetting(CURSOR_KEY(table, uid), maxSynced)
    }
    set({ progress: null })
  }

  // ── Files & thumbnails ────────────────────────────────────────────────

  async function fetchMissingThumbs(uid) {
    const need = await db.scores
      .where('ownerId')
      .equals(uid)
      .filter((s) => (s.cloudThumbVersion || 0) > (s.remoteThumbVersion || 0) && !((s.thumbVersion || 0) > (s.remoteThumbVersion || 0)))
      .toArray()
    let i = 0
    const worker = async () => {
      while (i < need.length) {
        const s = need[i++]
        try {
          const bytes = await cloud.downloadFile(thumbPath(uid, s.id))
          await db.scores.update(s.id, { thumb: bytes, thumbMime: 'image/jpeg', thumbVersion: s.cloudThumbVersion, remoteThumbVersion: s.cloudThumbVersion })
        } catch {
          /* try again next sync */
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(THUMB_CONCURRENCY, need.length) }, worker))
  }

  /** Re-download PDFs kept offline whose bytes changed on another device. */
  async function refreshChangedFiles(uid) {
    const ids = new Set(await db.files.toCollection().primaryKeys())
    const stale = await db.scores
      .where('ownerId')
      .equals(uid)
      .filter((s) => ids.has(s.id) && (s.cloudFileVersion || 0) > (s.remoteFileVersion || 0) && !((s.fileVersion || 0) > (s.remoteFileVersion || 0)))
      .toArray()
    for (const s of stale) {
      try {
        await downloadScore(s.id)
      } catch {
        /* next time */
      }
    }
  }

  async function downloadScore(scoreId) {
    if (!user) throw new Error('Logga in för att ladda ner noter.')
    const score = await db.scores.get(scoreId)
    if (!score) throw new Error('Stycket finns inte.')
    const version = score.cloudFileVersion || score.remoteFileVersion || score.fileVersion || 0
    if (!version) throw new Error('Stycket har ingen fil i molnet ännu.')
    if (downloading.has(scoreId)) return
    downloading.add(scoreId)
    emit()
    try {
      const bytes = await cloud.downloadFile(filePath(user.id, scoreId))
      await storeDownloadedFile(scoreId, bytes, version)
      await invalidateDoc(scoreId)
    } finally {
      downloading.delete(scoreId)
      emit()
    }
  }

  async function removeDownload(scoreId) {
    const score = await db.scores.get(scoreId)
    if (!score) return
    if (!score.ownerId) throw new Error('Stycket finns bara på den här enheten – ta bort det i stället.')
    if ((score.fileVersion || 0) > (score.remoteFileVersion || 0)) throw new Error('Sidorna är inte uppladdade ännu. Synka först.')
    await dbRemoveDownload(scoreId)
    await invalidateDoc(scoreId)
  }

  // ── Orchestration ─────────────────────────────────────────────────────

  async function sync(reason = 'manual') {
    if (!user) return
    if (running) {
      queued = true
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set({ phase: 'offline' })
      await refreshPending()
      return
    }
    running = true
    set({ phase: 'syncing', error: null })
    const uid = user.id
    try {
      await pushTombstones(uid)
      await pushDirty(uid)
      await pullAll(uid)
      await fetchMissingThumbs(uid)
      await refreshChangedFiles(uid)
      const t = Date.now()
      await setSetting(LAST_KEY(uid), t)
      set({ phase: 'idle', lastSyncAt: t, error: null, progress: null })
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      set({ phase: offline ? 'offline' : 'error', error: offline ? null : err?.message || String(err), progress: null })
      if (!offline) console.warn('[sync]', reason, err)
    } finally {
      running = false
      await refreshPending()
      if (queued) {
        queued = false
        schedule(500)
      }
    }
  }

  return { start, stop, setUser, sync, schedule, downloadScore, removeDownload, refreshPending, isDownloading: (id) => downloading.has(id), getStatus: () => ({ ...status, downloading: [...downloading] }) }
}
