import { useEffect, useState } from 'react'
import { acquireScoreDocument, releaseScoreDocument, describePdfError, pdfEvents } from '../lib/pdf.js'

/**
 * Open (and hold) the pdf.js document for a score. Released on unmount.
 * Pass `version` to force a reload after the file bytes were replaced; the hook
 * also reloads by itself when the document cache is invalidated elsewhere (a
 * download that replaced the bytes, the page manager, a backup restore).
 * Returns { doc, error, loading }.
 */
export function usePdfDocument(scoreId, version = 0) {
  const [state, setState] = useState({ doc: null, error: null, forId: null, forVersion: -1 })
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    if (!scoreId) return
    const onInvalidate = (e) => {
      if (e.detail?.scoreId === scoreId) setGeneration((g) => g + 1)
    }
    pdfEvents.addEventListener('invalidate', onInvalidate)
    return () => pdfEvents.removeEventListener('invalidate', onInvalidate)
  }, [scoreId])

  const key = `${version}:${generation}`
  useEffect(() => {
    if (!scoreId) return
    let active = true
    acquireScoreDocument(scoreId)
      .then((doc) => {
        if (active) setState({ doc, error: null, forId: scoreId, forVersion: key })
      })
      .catch((err) => {
        if (active) setState({ doc: null, error: describePdfError(err), forId: scoreId, forVersion: key })
      })
    return () => {
      active = false
      releaseScoreDocument(scoreId)
    }
  }, [scoreId, key])
  const current = !!scoreId && state.forId === scoreId && state.forVersion === key
  return { doc: current ? state.doc : null, error: current ? state.error : null, loading: !!scoreId && !current }
}
