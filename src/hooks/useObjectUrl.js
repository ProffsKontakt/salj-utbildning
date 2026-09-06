import { useEffect, useState } from 'react'

/**
 * Object URL for an ArrayBuffer/Blob that is revoked automatically when the data
 * changes/unmounts.
 *
 * Live queries hand back a freshly structured-cloned buffer on every refresh, so a
 * caller that knows a stable identity for the bytes (e.g. `${score.id}:${score.updatedAt}`)
 * passes it as `key`; the URL is then kept across refreshes instead of being revoked,
 * re-created and re-decoded for every record. Without `key` the buffer identity is used.
 */
export function useObjectUrl(data, mime = 'image/jpeg', key) {
  const identity = key ?? data
  const [entry, setEntry] = useState({ identity: null, url: null })
  useEffect(() => {
    if (!data) return
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
    const u = URL.createObjectURL(blob)
    // Object URLs are an external resource whose lifecycle must follow this effect,
    // so the state update belongs here (StrictMode re-runs create a fresh URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ identity, url: u })
    return () => URL.revokeObjectURL(u)
    // `data` is deliberately not a dependency: the URL follows `identity`, and a new
    // buffer instance carrying the same identity holds the same bytes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, mime])
  return data && entry.identity === identity ? entry.url : null
}
