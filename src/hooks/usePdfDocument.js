import { useEffect, useState } from 'react'
import { acquireScoreDocument, releaseScoreDocument, describePdfError } from '../lib/pdf.js'

/**
 * Open (and hold) the pdf.js document for a score. Released on unmount.
 * Pass `version` to force a reload after the file bytes were replaced.
 * Returns { doc, error, loading }.
 */
export function usePdfDocument(scoreId, version = 0) {
  const [state, setState] = useState({ doc: null, error: null, forId: null, forVersion: -1 })
  useEffect(() => {
    if (!scoreId) return
    let active = true
    acquireScoreDocument(scoreId)
      .then((doc) => {
        if (active) setState({ doc, error: null, forId: scoreId, forVersion: version })
      })
      .catch((err) => {
        if (active) setState({ doc: null, error: describePdfError(err), forId: scoreId, forVersion: version })
      })
    return () => {
      active = false
      releaseScoreDocument(scoreId)
    }
  }, [scoreId, version])
  const current = !!scoreId && state.forId === scoreId && state.forVersion === version
  return { doc: current ? state.doc : null, error: current ? state.error : null, loading: !!scoreId && !current }
}
