// State + persistence for the page manager: an optimistic local copy of
// pageOrder/rotations that is written to the database on every change, plus a
// debounced refresh of the library thumbnail whenever the first displayed page
// (or its rotation) changes.
//
// All action callbacks are referentially stable (they read the latest state
// through a ref) so 300 memoised tiles do not re-render on every change.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { getScore, getScoreFile, normalizeRotation, updateScore } from '../../db/db.js'
import { refreshThumbnail } from '../../lib/importScore.js'

const THUMB_DEBOUNCE_MS = 800
const EMPTY_ORDER = []
const EMPTY_ROTATIONS = {}

function thumbKey(order, rotations) {
  const first = order[0]
  return first === undefined ? 'none' : `${first}:${rotations[first] || 0}`
}

/**
 * @param {string} scoreId
 * @param {object|null} score   live score row (null = loading)
 * @param {{ error: (msg:string)=>void }} toast
 */
export function usePageEditor(scoreId, score, toast) {
  // Bumped after the file bytes were replaced (append) → reload the document.
  const [version, setVersion] = useState(0)
  const [local, setLocal] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const key = `${scoreId}:${version}`

  const fromScore = useMemo(
    () => (score ? { key, order: score.pageOrder || [], rotations: score.rotations || {} } : null),
    [score, key],
  )
  const state = local && local.key === key ? local : fromScore
  const order = state?.order || EMPTY_ORDER
  const rotations = state?.rotations || EMPTY_ROTATIONS
  const pageCount = score?.pageCount || 0

  // Latest values for the stable callbacks below. Updated after every render
  // and eagerly inside commit() so two actions in one tick never see stale data.
  const latest = useRef({ key, order, rotations, pageCount, version, toast })
  useEffect(() => {
    latest.current = { key, order, rotations, pageCount, version, toast }
  })

  // ── Thumbnail refresh (debounced) ─────────────────────────────────────
  const thumbTimer = useRef(null)

  const runThumbRefresh = useCallback(async () => {
    try {
      const fresh = await getScore(scoreId)
      if (!fresh) return
      const file = await getScoreFile(scoreId)
      if (!file) return
      await refreshThumbnail(fresh, file.data)
    } catch {
      latest.current.toast?.error('Miniaturbilden kunde inte uppdateras.')
    }
  }, [scoreId])

  const scheduleThumbRefresh = useCallback(() => {
    if (thumbTimer.current) clearTimeout(thumbTimer.current)
    thumbTimer.current = setTimeout(() => {
      thumbTimer.current = null
      runThumbRefresh()
    }, THUMB_DEBOUNCE_MS)
  }, [runThumbRefresh])

  /** Run a pending thumbnail refresh right away (used when leaving the view). */
  const flushThumbRefresh = useCallback(() => {
    if (!thumbTimer.current) return
    clearTimeout(thumbTimer.current)
    thumbTimer.current = null
    runThumbRefresh()
  }, [runThumbRefresh])

  useEffect(() => flushThumbRefresh, [flushThumbRefresh])

  // ── Commit helpers ────────────────────────────────────────────────────
  const commit = useCallback(
    (nextOrder, nextRotations, message) => {
      const cur = latest.current
      const prevKey = thumbKey(cur.order, cur.rotations)
      latest.current = { ...cur, order: nextOrder, rotations: nextRotations }
      setLocal({ key: cur.key, order: nextOrder, rotations: nextRotations })
      const patch = {}
      if (nextOrder !== cur.order) patch.pageOrder = nextOrder
      if (nextRotations !== cur.rotations) patch.rotations = nextRotations
      if (Object.keys(patch).length) {
        updateScore(scoreId, patch).catch(() => latest.current.toast?.error('Ändringen kunde inte sparas.'))
      }
      if (thumbKey(nextOrder, nextRotations) !== prevKey) scheduleThumbRefresh()
      if (message) setAnnouncement(message)
    },
    [scoreId, scheduleThumbRefresh],
  )

  const reorder = useCallback(
    (nextOrder, message) => {
      const { order, rotations } = latest.current
      if (nextOrder.length !== order.length || nextOrder.some((v, i) => v !== order[i])) commit(nextOrder, rotations, message)
    },
    [commit],
  )

  /** Move the tile at display position `from` to display position `to`. */
  const move = useCallback(
    (from, to) => {
      const { order, rotations } = latest.current
      if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return false
      const src = order[from]
      commit(arrayMove(order, from, to), rotations, `Sida ${src + 1} flyttad till plats ${to + 1} av ${order.length}.`)
      return true
    },
    [commit],
  )

  const rotate = useCallback(
    (srcIndex) => {
      const { order, rotations } = latest.current
      const next = normalizeRotation((rotations[srcIndex] || 0) + 90)
      const nextRotations = { ...rotations }
      if (next === 0) delete nextRotations[srcIndex]
      else nextRotations[srcIndex] = next
      commit(order, nextRotations, next ? `Sida ${srcIndex + 1} roterad ${next} grader.` : `Sida ${srcIndex + 1} har ursprunglig riktning.`)
    },
    [commit],
  )

  /** Hide a page. Returns its previous display position, or -1 when nothing changed. */
  const remove = useCallback(
    (srcIndex) => {
      const { order, rotations } = latest.current
      if (order.length <= 1) return -1
      const position = order.indexOf(srcIndex)
      if (position < 0) return -1
      commit(order.filter((i) => i !== srcIndex), rotations, `Sida ${srcIndex + 1} dold. Den finns kvar i filen och kan återställas.`)
      return position
    },
    [commit],
  )

  /** Show a hidden page again – at the end, or at `position` when given (undo). */
  const restore = useCallback(
    (srcIndex, position) => {
      const { order, rotations } = latest.current
      if (order.includes(srcIndex)) return
      const at = Number.isInteger(position) ? Math.max(0, Math.min(order.length, position)) : order.length
      const nextOrder = order.slice()
      nextOrder.splice(at, 0, srcIndex)
      commit(nextOrder, rotations, `Sida ${srcIndex + 1} återställd på plats ${at + 1}.`)
    },
    [commit],
  )

  const resetOrder = useCallback(() => {
    const nextOrder = Array.from({ length: latest.current.pageCount }, (_, i) => i)
    commit(nextOrder, {}, 'Ursprunglig ordning och riktning återställd.')
  }, [commit])

  /** Adopt the record written by appendFilesToScore and reload the document. */
  const adoptAppended = useCallback(
    (fresh) => {
      const nextVersion = latest.current.version + 1
      const nextKey = `${scoreId}:${nextVersion}`
      const next = { key: nextKey, order: fresh.pageOrder || [], rotations: fresh.rotations || {} }
      latest.current = { ...latest.current, ...next, version: nextVersion, pageCount: fresh.pageCount || 0 }
      setVersion(nextVersion)
      setLocal(next)
    },
    [scoreId],
  )

  const removed = useMemo(() => {
    const present = new Set(order)
    const out = []
    for (let i = 0; i < pageCount; i++) if (!present.has(i)) out.push(i)
    return out
  }, [order, pageCount])

  const isOriginal = useMemo(
    () => order.length === pageCount && order.every((v, i) => v === i) && Object.keys(rotations).every((k) => !rotations[k]),
    [order, pageCount, rotations],
  )

  return {
    version,
    order,
    rotations,
    pageCount,
    removed,
    isOriginal,
    announcement,
    announce: setAnnouncement,
    reorder,
    move,
    rotate,
    remove,
    restore,
    resetOrder,
    adoptAppended,
    flushThumbRefresh,
  }
}
