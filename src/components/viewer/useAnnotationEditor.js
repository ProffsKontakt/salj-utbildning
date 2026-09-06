// Annotation editor state for ONE page of ONE score.
//
// The record is loaded imperatively (getAnnotation) – never through useLiveQuery – so
// our own writes cannot feed back into the editor. Every change is pushed onto an undo
// history (capped) and saved with putAnnotation, debounced 400 ms. Records are immutable –
// every mutation builds a new object – so the history holds plain references. Pending
// changes are flushed when the page/score changes, on unmount, when the tab is hidden
// and on pagehide, so a stroke is never lost.
//
// A small module-level cache keeps the most recently loaded records so that turning to
// a prefetched page shows its ink synchronously (no flash).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emptyAnnotation, getAnnotation, putAnnotation } from '../../db/db.js'

export const HISTORY_CAP = 60
export const SAVE_DEBOUNCE_MS = 400

const cache = new Map()
const CACHE_CAP = 24

const keyOf = (scoreId, pageIndex) => `${scoreId}:${pageIndex}`

function remember(key, record) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, record)
  while (cache.size > CACHE_CAP) cache.delete(cache.keys().next().value)
}

function normalize(scoreId, pageIndex, rec) {
  const base = emptyAnnotation(scoreId, pageIndex)
  if (!rec) return base
  return { ...base, ...rec, strokes: rec.strokes || [], texts: rec.texts || [], note: rec.note || '' }
}

/** Warm the cache for a page (used by the stage for the preloaded next page). */
export async function prefetchAnnotation(scoreId, pageIndex) {
  if (!scoreId || pageIndex == null || pageIndex < 0) return null
  const key = keyOf(scoreId, pageIndex)
  if (cache.has(key)) return cache.get(key)
  try {
    const rec = normalize(scoreId, pageIndex, await getAnnotation(scoreId, pageIndex))
    if (!cache.has(key)) remember(key, rec)
    return cache.get(key)
  } catch {
    return null
  }
}

/** Drop cached records for a score (called when the editor leaves the score). */
export function forgetAnnotations(scoreId) {
  if (!scoreId) return
  const prefix = `${scoreId}:`
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
}

/** Synchronous cache lookup (null when the page has not been loaded yet). */
export function peekAnnotation(scoreId, pageIndex) {
  return cache.get(keyOf(scoreId, pageIndex)) || null
}

export function hasInk(rec) {
  return !!rec && ((rec.strokes && rec.strokes.length > 0) || (rec.texts && rec.texts.length > 0))
}

/**
 * @param {string} scoreId
 * @param {number|null} pageIndex  SOURCE page index (null when there is no page)
 * @param {{ onSaveError?: (err: Error) => void }} [opts]
 */
export function useAnnotationEditor(scoreId, pageIndex, { onSaveError } = {}) {
  const active = !!scoreId && Number.isInteger(pageIndex) && pageIndex >= 0
  const key = active ? keyOf(scoreId, pageIndex) : null

  // One state object so key/annotation/history always agree. `rev` counts user edits;
  // persistence happens in an effect (below) so the updaters stay pure – StrictMode
  // double-invokes them and any side effect inside would double-apply a stroke.
  const [state, setState] = useState(() => ({ key: null, ann: null, past: [], future: [], rev: 0, edited: false }))

  // Derive the view for the current key: a stale state (previous page) is ignored and
  // the cache is consulted synchronously, so a prefetched page paints without a flash.
  const view = useMemo(() => {
    if (!key) return { ann: null, past: [], future: [], loaded: false }
    if (state.key === key) return { ann: state.ann, past: state.past, future: state.future, loaded: true }
    const cached = cache.get(key)
    return { ann: cached || null, past: [], future: [], loaded: !!cached }
  }, [key, state])

  const onSaveErrorRef = useRef(onSaveError)
  useEffect(() => {
    onSaveErrorRef.current = onSaveError
  }, [onSaveError])

  // ── Persistence ──────────────────────────────────────────────────────────
  const pendingRef = useRef(null) // { scoreId, pageIndex, record }
  const timerRef = useRef(0)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = 0
    const p = pendingRef.current
    if (!p) return Promise.resolve()
    pendingRef.current = null
    return putAnnotation(p.scoreId, p.pageIndex, { strokes: p.record.strokes, texts: p.record.texts, note: p.record.note }).then(
      () => undefined,
      (err) => {
        // keep the change around so a later flush can retry
        if (!pendingRef.current) pendingRef.current = p
        onSaveErrorRef.current?.(err)
      },
    )
  }, [])

  const schedule = useCallback(
    (record) => {
      pendingRef.current = { scoreId: record.scoreId, pageIndex: record.pageIndex, record }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  // Persist every user edit (debounced) and mirror it into the cache.
  const persistedRef = useRef('')
  useEffect(() => {
    if (!state.key || !state.edited || !state.ann) return
    const stamp = `${state.key}#${state.rev}`
    if (persistedRef.current === stamp) return
    persistedRef.current = stamp
    remember(state.key, state.ann)
    schedule(state.ann)
  }, [state, schedule])

  // Flush when the page/score changes and on unmount.
  useEffect(() => {
    return () => {
      flush()
    }
  }, [key, flush])

  // The cache only lives while a score is open, so ink changed elsewhere (page manager,
  // backup restore, "clear annotations") is never resurrected from a stale copy.
  useEffect(() => {
    return () => forgetAnnotations(scoreId)
  }, [scoreId])

  // Flush when the app is backgrounded or the page is torn down.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onHide = () => flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [flush])

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!key || cache.has(key)) return
    let alive = true
    getAnnotation(scoreId, pageIndex)
      .then((rec) => {
        if (!alive) return
        const record = normalize(scoreId, pageIndex, rec)
        if (!cache.has(key)) remember(key, record)
        // Adopt the loaded record unless the user has already changed this page.
        setState((s) => (s.key === key ? s : { key, ann: cache.get(key), past: [], future: [], rev: s.rev + 1, edited: false }))
      })
      .catch((err) => {
        if (!alive) return
        // Never adopt an empty record for a page whose load failed: the database may
        // still hold ink for it, and the next edit would replace it with the empty
        // record. The page stays `loaded: false` (read-only) until a later load succeeds.
        onSaveErrorRef.current?.(err)
      })
    return () => {
      alive = false
    }
  }, [key, scoreId, pageIndex])

  // ── Mutations ────────────────────────────────────────────────────────────
  /** Apply a change; `history:false` skips the undo stack (used for the free-text note). */
  const apply = useCallback(
    (mutate, { history = true } = {}) => {
      if (!key) return
      setState((s) => {
        const sameKey = s.key === key
        // Only mutate a record that has actually been loaded for this page (state or
        // cache). Editing before the load resolves would start from an empty record and
        // the debounced save would overwrite whatever the database holds.
        const base = sameKey ? s.ann : cache.get(key)
        if (!base) return s
        const next = mutate(base)
        if (!next || next === base) return s
        const record = { ...next, scoreId, pageIndex }
        const rev = s.rev + 1
        if (!history) return { key, ann: record, past: sameKey ? s.past : [], future: sameKey ? s.future : [], rev, edited: true }
        const past = [...(sameKey ? s.past : []), base]
        if (past.length > HISTORY_CAP) past.splice(0, past.length - HISTORY_CAP)
        return { key, ann: record, past, future: [], rev, edited: true }
      })
    },
    [key, scoreId, pageIndex],
  )

  const commitStroke = useCallback(
    (stroke) => {
      if (!stroke || !stroke.points || stroke.points.length < 2) return
      apply((a) => ({ ...a, strokes: [...a.strokes, stroke] }))
    },
    [apply],
  )

  const erase = useCallback(
    ({ strokeIds = [], textIds = [] } = {}) => {
      if (!strokeIds.length && !textIds.length) return
      const s = new Set(strokeIds)
      const t = new Set(textIds)
      apply((a) => ({ ...a, strokes: a.strokes.filter((x) => !s.has(x.id)), texts: a.texts.filter((x) => !t.has(x.id)) }))
    },
    [apply],
  )

  const addText = useCallback(
    (text) => {
      if (!text || !String(text.text || '').trim()) return
      apply((a) => ({ ...a, texts: [...a.texts, text] }))
    },
    [apply],
  )

  const updateText = useCallback(
    (id, patch) => {
      apply((a) => {
        const i = a.texts.findIndex((x) => x.id === id)
        if (i < 0) return a
        const texts = a.texts.slice()
        texts[i] = { ...texts[i], ...patch }
        return { ...a, texts }
      })
    },
    [apply],
  )

  const removeText = useCallback(
    (id) => {
      apply((a) => (a.texts.some((x) => x.id === id) ? { ...a, texts: a.texts.filter((x) => x.id !== id) } : a))
    },
    [apply],
  )

  const setNote = useCallback(
    (note) => {
      apply((a) => (a.note === note ? a : { ...a, note }), { history: false })
    },
    [apply],
  )

  const clearPage = useCallback(() => {
    apply((a) => (hasInk(a) ? { ...a, strokes: [], texts: [] } : a))
  }, [apply])

  const undo = useCallback(() => {
    if (!key) return
    setState((s) => {
      if (s.key !== key || !s.past.length) return s
      const past = s.past.slice()
      const prev = past.pop()
      const record = { ...prev, scoreId, pageIndex, note: s.ann.note }
      return { key, ann: record, past, future: [...s.future, s.ann], rev: s.rev + 1, edited: true }
    })
  }, [key, scoreId, pageIndex])

  const redo = useCallback(() => {
    if (!key) return
    setState((s) => {
      if (s.key !== key || !s.future.length) return s
      const future = s.future.slice()
      const next = future.pop()
      const record = { ...next, scoreId, pageIndex, note: s.ann.note }
      return { key, ann: record, past: [...s.past, s.ann], future, rev: s.rev + 1, edited: true }
    })
  }, [key, scoreId, pageIndex])

  return {
    annotation: view.ann,
    loaded: view.loaded,
    canUndo: view.past.length > 0,
    canRedo: view.future.length > 0,
    note: view.ann?.note || '',
    hasInk: hasInk(view.ann),
    commitStroke,
    erase,
    addText,
    updateText,
    removeText,
    setNote,
    clearPage,
    undo,
    redo,
    flush,
  }
}
