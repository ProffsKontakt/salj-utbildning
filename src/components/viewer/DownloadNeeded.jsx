// Shown in place of the score when its PDF is not on this device (a cloud-only score).
import { Link } from 'react-router-dom'
import { CloudDownload, Library } from 'lucide-react'
import { Button, Spinner, cn } from '../ui/index.js'
import { useSync } from '../../lib/sync/useSync.js'
import { formatBytes } from '../../lib/bytes.js'
import { pluralize } from '../../lib/format.js'

/** Spinner + label for a download in progress (used in the card and on the concert stage). */
export function DownloadProgress({ className }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-gold-200', className)} role="status" data-testid="download-progress">
      <Spinner className="size-5" />
      <span>Laddar ner…</span>
    </div>
  )
}

/**
 * @param {object} p
 * @param {object} p.score        score row
 * @param {object} p.offline      result of useOfflineFile(score.id)
 * @param {string} [p.backTo]     target of the secondary link
 * @param {string} [p.backLabel]
 */
export function DownloadNeeded({ score, offline, backTo = '/', backLabel = 'Till biblioteket', className }) {
  const { online, user, authLoading } = useSync()
  const needsSignIn = !user && !authLoading
  const pageCount = score.pageOrder?.length ?? score.pageCount ?? 0
  const state = offline.downloading ? 'downloading' : offline.error ? 'error' : 'idle'

  return (
    <div className={cn('flex items-center justify-center px-4 py-8 sm:px-6', className)}>
      <div className="w-full max-w-md rounded-3xl bg-ink-850 px-6 py-7 text-center shadow-stage animate-fade-in sm:px-8" data-testid="download-needed" data-state={state}>
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-gold-500/10 text-gold-300 shadow-glow">
          <CloudDownload className="size-7" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl leading-tight text-ivory-50">{score.title}</h2>
        {score.composer ? <p className="mt-1 text-sm text-ivory-300">{score.composer}</p> : null}
        <p className="mt-3 text-[15px] leading-relaxed text-ivory-400">Det här stycket finns i ditt konto men är inte nedladdat på den här enheten.</p>
        <p className="mt-1 text-xs text-ivory-500 tabular-nums">
          {pluralize(pageCount, 'sida', 'sidor')}
          {score.fileSize ? ` · ${formatBytes(score.fileSize)}` : ''}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          {state === 'downloading' ? (
            <DownloadProgress className="h-13" />
          ) : (
            <>
              {offline.error ? (
                <p className="text-sm text-[#f08a86]" role="alert" data-testid="download-error">
                  {offline.error}
                </p>
              ) : null}
              <Button size="lg" onClick={() => offline.download()} disabled={!online || needsSignIn} data-testid="download-score-now" className="min-w-44">
                <CloudDownload className="size-5" aria-hidden="true" />
                {offline.error ? 'Försök igen' : 'Ladda ner'}
              </Button>
              {!online ? (
                <p className="text-xs text-ivory-500" data-testid="download-hint">
                  Anslut till internet för att ladda ner
                </p>
              ) : needsSignIn ? (
                <p className="text-xs text-ivory-500" data-testid="download-hint">
                  <Link to="/konto" className="text-gold-300 hover:underline">
                    Logga in
                  </Link>{' '}
                  för att ladda ner
                </p>
              ) : null}
            </>
          )}
          <Button as={Link} to={backTo} variant="ghost" size="sm">
            <Library className="size-4" aria-hidden="true" />
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
