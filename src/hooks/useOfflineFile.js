// Whether a score's PDF bytes are on this device, plus a way to fetch them from
// the account. Scores that arrive from the cloud have no `files` row until they
// are downloaded ("cloud-only"); opening such a score needs the download first.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, isDownloaded } from '../db/db.js'
import { useSync } from '../lib/sync/useSync.js'

let versionSeq = 0

function describeDownloadError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Ingen internetanslutning – nedladdningen avbröts.'
  return err?.message || 'Nedladdningen misslyckades.'
}

/**
 * @param {string|null} scoreId
 * @param {object} [opts]
 * @param {boolean} [opts.auto]  force (true) or suppress (false) the automatic download;
 *                               omitted = follow the `autoDownload` setting
 * @param {(message:string, err:Error) => void} [opts.onError]  called when a download fails
 * @returns {{ ready:boolean, cloudOnly:boolean, loading:boolean, downloading:boolean,
 *             error:string|null, download:() => Promise<boolean>, version:number }}
 *   ready       the PDF is stored locally – safe to open with usePdfDocument
 *   cloudOnly   the score belongs to the account but is not downloaded on this device
 *   loading     the local check has not finished yet
 *   downloading a download is in flight (started here or by the sync engine)
 *   error       message of the last failed download for this score
 *   download()  start a download; resolves true once the file is on the device (never rejects)
 *   version     changes after every successful download – pass it on to usePdfDocument
 *
 * A cloud-only score is downloaded automatically (once per score) when online,
 * signed in and the `autoDownload` setting is on. The local check is a live
 * query, so `ready` also flips when the sync engine or another view stores or
 * removes the file.
 */
export function useOfflineFile(scoreId, { auto, onError } = {}) {
  const { downloadScore, isDownloading, cloudReady, user, online } = useSync()
  // getSetting resolves to the default (true) when the row was never written, so
  // `undefined` reliably means "not read yet" – no download before the setting is known.
  const autoSetting = useLiveQuery(() => getSetting('autoDownload'), [], undefined)

  // { id, downloaded, owned } for the current id; null while checking or for a stale id.
  const info = useLiveQuery(
    async () => {
      if (!scoreId) return null
      const downloaded = await isDownloaded(scoreId)
      const score = await db.scores.get(scoreId)
      return { id: scoreId, downloaded, owned: !!score?.ownerId }
    },
    [scoreId],
    null,
  )
  const current = info && info.id === scoreId ? info : null
  const ready = !!current?.downloaded
  const cloudOnly = !!current && !current.downloaded && current.owned
  const loading = !!scoreId && !current

  // Outcome of the download started from this hook, keyed by score id.
  const [state, setState] = useState({ id: null, busy: false, error: null, version: 0 })
  const own = state.id === scoreId ? state : null

  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const download = useCallback(() => {
    const id = scoreId
    if (!id) return Promise.resolve(false)
    const keep = (s) => (s.id === id ? s.version : 0)
    // Every state change happens inside a promise callback, so the auto-download
    // effect below can call this without setting state synchronously.
    return Promise.resolve()
      .then(() => {
        setState((s) => ({ id, busy: true, error: null, version: keep(s) }))
        return downloadScore(id)
      })
      .then(async () => {
        // The engine skips a score it is already fetching; then `ready` flips through the live query.
        const ok = await isDownloaded(id)
        if (!ok && !cloudReady) throw new Error('Molntjänsten är inte tillgänglig just nu.')
        const version = ok ? ++versionSeq : null
        setState((s) => ({ id, busy: false, error: null, version: version ?? keep(s) }))
        return ok
      })
      .catch((err) => {
        const message = describeDownloadError(err)
        setState((s) => ({ id, busy: false, error: message, version: keep(s) }))
        onErrorRef.current?.(message, err)
        return false
      })
  }, [scoreId, downloadScore, cloudReady])

  // Automatic download: once per score, as soon as the conditions hold.
  const autoOn = auto === true || (auto !== false && autoSetting !== undefined && autoSetting !== false)
  const autoTriedFor = useRef(null)
  useEffect(() => {
    if (!scoreId || !cloudOnly || !autoOn || !online || !cloudReady || !user) return
    if (autoTriedFor.current === scoreId) return
    autoTriedFor.current = scoreId
    download()
  }, [scoreId, cloudOnly, autoOn, online, cloudReady, user, download])

  const downloading = !!own?.busy || (!!scoreId && isDownloading(scoreId))
  return { ready, cloudOnly, loading, downloading, error: own?.error ?? null, download, version: own?.version ?? 0 }
}
