import { PageHeader } from '../components/PageHeader.jsx'
import { AccountSummaryCard } from '../components/settings/AccountSummaryCard.jsx'
import { ReadingCard } from '../components/settings/ReadingCard.jsx'
import { StorageCard } from '../components/settings/StorageCard.jsx'
import { InstallCard } from '../components/settings/InstallCard.jsx'
import { BackupCard } from '../components/settings/BackupCard.jsx'
import { DangerZone } from '../components/settings/DangerZone.jsx'
import { AboutCard } from '../components/settings/AboutCard.jsx'

/** /installningar – preferences, storage, install, backup, wipe, about. */
export default function Settings() {
  return (
    <div data-testid="settings-page">
      <PageHeader eyebrow="Inställningar" title="Notställ" description="Konto, läsning, lagring och säkerhetskopior av ditt bibliotek." />
      <div className="mx-auto mt-6 grid max-w-6xl gap-4 px-4 pb-4 sm:px-6 md:px-10 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-4">
          <AccountSummaryCard />
          <ReadingCard />
          <StorageCard />
          <InstallCard />
        </div>
        <div className="flex flex-col gap-4">
          <BackupCard />
          <DangerZone />
          <AboutCard />
        </div>
      </div>
    </div>
  )
}
