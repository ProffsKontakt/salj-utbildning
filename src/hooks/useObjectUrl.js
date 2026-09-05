import { useEffect, useState } from 'react'

/** Object URL for an ArrayBuffer/Blob that is revoked automatically when data changes/unmounts. */
export function useObjectUrl(data, mime = 'image/jpeg') {
  const [entry, setEntry] = useState({ data: null, url: null })
  useEffect(() => {
    if (!data) return
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
    const u = URL.createObjectURL(blob)
    // Object URLs are an external resource whose lifecycle must follow this effect,
    // so the state update belongs here (StrictMode re-runs create a fresh URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ data, url: u })
    return () => URL.revokeObjectURL(u)
  }, [data, mime])
  return entry.data === data ? entry.url : null
}
