import { Spinner } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { useSync } from '../../lib/sync/useSync.js'
import { summarizeSync } from './syncSummary.js'

/** Compact sync pill for the library header. Renders nothing when signed out. */
export function LibrarySyncStatus({ className }) {
  const { user, online, status } = useSync()
  if (!user) return null
  const s = summarizeSync(status, online)
  return (
    <span
      data-testid="library-sync-status"
      data-phase={s.phase}
      role="status"
      title={s.phase === 'error' && status.error ? status.error : undefined}
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-800/80 px-2.5 py-1 align-middle text-xs font-medium hairline', s.tone, className)}
    >
      {s.icon ? <s.icon className="size-3.5" aria-hidden="true" /> : <Spinner className="size-3.5" />}
      {s.label}
    </span>
  )
}
