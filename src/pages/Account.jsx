import { PageHeader } from '../components/PageHeader.jsx'
import { LoginCard } from '../components/account/LoginCard.jsx'
import { AccountCard } from '../components/account/AccountCard.jsx'
import { OfflineCard } from '../components/account/OfflineCard.jsx'
import { useSync } from '../lib/sync/useSync.js'
import { Spinner } from '../components/ui/index.js'

export default function Account() {
  const { user, authLoading } = useSync()
  return (
    <div data-testid="account-page">
      <PageHeader eyebrow="Konto" title={user ? 'Ditt notställ i molnet' : 'Konto'} description={user ? 'Dina noter, anteckningar och projekt följer med till alla enheter där du loggar in.' : 'Logga in för att spara biblioteket i molnet och använda det på flera enheter.'} />
      <div className="mt-6 grid gap-5 px-4 sm:px-6 md:px-10 lg:grid-cols-2">
        {authLoading ? (
          <div className="flex items-center gap-3 text-ivory-400">
            <Spinner className="size-5" /> Kontrollerar inloggning…
          </div>
        ) : user ? (
          <>
            <AccountCard />
            <OfflineCard />
          </>
        ) : (
          <LoginCard />
        )}
      </div>
    </div>
  )
}
