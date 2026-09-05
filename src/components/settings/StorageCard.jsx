import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HardDrive, ShieldCheck, TriangleAlert, Info } from 'lucide-react'
import { db, totalFileBytes } from '../../db/db.js'
import { formatBytes } from '../../lib/bytes.js'
import { pluralize } from '../../lib/format.js'
import { isIOS, isStandalone, requestPersistentStorage, storageEstimate } from '../../lib/platform.js'
import { Button, useToast } from '../ui/index.js'
import { SettingsCard, Notice } from './SettingsCard.jsx'

async function readPersisted() {
  try {
    if (!navigator.storage?.persisted) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

/** Storage usage, quota, persistence status and the iOS caveats. */
export function StorageCard() {
  const toast = useToast()
  const library = useLiveQuery(async () => ({ count: await db.scores.count(), bytes: await totalFileBytes() }), [], null)
  // { usage, quota } | null (unsupported) | undefined (loading)
  const [estimate, setEstimate] = useState(undefined)
  // true | false | null (unsupported) | undefined (loading)
  const [persisted, setPersisted] = useState(undefined)
  const [requesting, setRequesting] = useState(false)

  const refresh = useCallback(() => {
    let active = true
    Promise.all([storageEstimate(), readPersisted()]).then(([est, per]) => {
      if (!active) return
      setEstimate(est)
      setPersisted(per)
    })
    return () => {
      active = false
    }
  }, [])

  // Re-measure whenever the library changes (import, delete, clear).
  const libraryKey = library ? `${library.count}:${library.bytes}` : ''
  useEffect(() => refresh(), [refresh, libraryKey])

  const requestPersist = async () => {
    setRequesting(true)
    try {
      const ok = await requestPersistentStorage()
      setPersisted(ok)
      if (ok) toast.success('Beständig lagring är aktiverad.')
      else toast.info('Webbläsaren gav inte beständig lagring just nu. Installera appen eller lägg till den som bokmärke och försök igen.')
    } catch {
      toast.error('Kunde inte begära beständig lagring.')
    } finally {
      setRequesting(false)
    }
  }

  const usage = estimate?.usage || 0
  const quota = estimate?.quota || 0
  const fraction = quota > 0 ? Math.min(1, usage / quota) : 0
  const percent = Math.round(fraction * 100)
  const iosTab = isIOS() && !isStandalone()

  return (
    <SettingsCard icon={HardDrive} title="Lagring" description="Allt sparas i webbläsarens databas på den här enheten – ingenting skickas till någon server.">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-[15px] text-ivory-50" data-testid="storage-summary">
          {library === null ? 'Räknar…' : `${pluralize(library.count, 'stycke', 'stycken')} · ${formatBytes(library.bytes)} noter`}
        </div>
        <div className="text-[13px] text-ivory-400">
          {estimate === undefined ? 'Mäter lagringsutrymme…' : estimate === null || !quota ? 'Lagringsutrymme kan inte mätas här' : `${formatBytes(usage)} av ${formatBytes(quota)} använt`}
        </div>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-label="Använt lagringsutrymme"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={quota ? percent : undefined}
        aria-valuetext={quota ? `${percent} procent använt` : 'Okänt'}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-500"
          style={{ width: quota ? `${Math.max(fraction > 0 ? 1.5 : 0, percent)}%` : '0%' }}
        />
      </div>
      {quota ? <div className="mt-1.5 text-xs text-ivory-500">Notställ delar utrymmet med webbläsarens övriga data. Siffran är webbläsarens uppskattning.</div> : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-[13px] leading-relaxed text-ivory-300">
          {persisted === true ? (
            <span className="inline-flex items-center gap-2 text-ivory-100">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Beständig lagring är aktiverad – webbläsaren rensar inte dina noter automatiskt.
            </span>
          ) : persisted === null ? (
            'Den här webbläsaren kan inte lova beständig lagring. Ta en säkerhetskopia med jämna mellanrum.'
          ) : persisted === false ? (
            'Utan beständig lagring får webbläsaren rensa databasen när utrymmet tar slut. Begär beständig lagring så skyddas dina noter.'
          ) : (
            'Kontrollerar lagringsstatus…'
          )}
        </div>
        {persisted === false ? (
          <Button variant="secondary" size="sm" onClick={requestPersist} loading={requesting} data-testid="request-persist" className="shrink-0 self-start sm:self-auto">
            Begär beständig lagring
          </Button>
        ) : null}
      </div>

      {iosTab ? (
        <Notice icon={TriangleAlert} tone="warn" className="mt-4">
          <strong className="font-medium text-gold-200">Du använder Notställ i en webbläsarflik på iPhone/iPad.</strong> Safari kan radera sparade data för webbplatser som inte
          använts på sju dagar. Appen på hemskärmen har dessutom ett <em>eget, separat</em> bibliotek – installera därför appen <strong className="font-medium">innan</strong> du
          importerar dina noter, eller ta en säkerhetskopia och läs in den i den installerade appen.
        </Notice>
      ) : isIOS() ? (
        <Notice icon={Info} tone="info" className="mt-4">
          Appen är installerad på hemskärmen och har sitt eget bibliotek, skilt från Safari. Radera inte appen utan att först ta en säkerhetskopia.
        </Notice>
      ) : null}
    </SettingsCard>
  )
}
