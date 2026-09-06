import { Link } from 'react-router-dom'
import { ChevronRight, LogIn, UserRound } from 'lucide-react'
import { Button, Spinner } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { useSync } from '../../lib/sync/useSync.js'
import { summarizeSync } from '../library/syncSummary.js'
import { SettingsCard } from './SettingsCard.jsx'

/** Who is signed in (and how sync is doing), or a nudge to sign in. Details live on /konto. */
export function AccountSummaryCard() {
  const { user, authLoading, online, status } = useSync()
  const s = user ? summarizeSync(status, online) : null
  return (
    <SettingsCard
      icon={UserRound}
      title="Konto & moln"
      description={user ? 'Noter, anteckningar och projekt synkas till ditt konto och finns på alla dina enheter.' : 'Spara biblioteket i molnet och använd det på alla dina enheter.'}
      testId="settings-account-card"
    >
      {authLoading ? (
        <p className="flex items-center gap-2 text-sm text-ivory-400">
          <Spinner className="size-4" /> Kontrollerar inloggning…
        </p>
      ) : user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-[15px] text-ivory-50" data-testid="settings-account-email">
              Inloggad som {user.email}
            </p>
            <p className={cn('mt-1 inline-flex items-center gap-1.5 text-[13px]', s.tone)} data-testid="settings-sync-status" data-phase={s.phase}>
              {s.icon ? <s.icon className="size-3.5" aria-hidden="true" /> : <Spinner className="size-3.5" />}
              {s.label}
            </p>
          </div>
          <Button as={Link} to="/konto" variant="secondary" size="sm" data-testid="settings-account-link" className="shrink-0 self-start sm:self-auto">
            Hantera konto
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button as={Link} to="/konto" data-testid="settings-account-login" className="w-full sm:w-auto sm:min-w-[15.5rem]">
          <LogIn className="size-4" aria-hidden="true" />
          Logga in
        </Button>
      )}
    </SettingsCard>
  )
}
