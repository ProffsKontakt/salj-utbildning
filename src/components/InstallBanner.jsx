// CONTRACT (settings module):
// <InstallBanner /> renders a dismissible hint to install the app to the home
// screen when running in a browser tab on a mobile device; renders null otherwise.
import { useState } from 'react'
import { Smartphone, X, MonitorDown } from 'lucide-react'
import { isIOS, isStandalone } from '../lib/platform.js'
import { useInstallPrompt } from '../hooks/useInstallPrompt.js'
import { Button, Dialog, IconButton, useToast } from './ui/index.js'
import { IosInstallSteps } from './settings/IosInstallSteps.jsx'

const DISMISS_KEY = 'notstall.installBannerDismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* private mode – the banner simply returns next visit */
  }
}

export function InstallBanner() {
  const toast = useToast()
  const { canInstall, installed, prompt } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [showHow, setShowHow] = useState(false)
  const [busy, setBusy] = useState(false)

  if (dismissed || installed || isStandalone()) return null
  const ios = isIOS()
  if (!ios && !canInstall) return null

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  const install = async () => {
    setBusy(true)
    try {
      const outcome = await prompt()
      if (outcome === 'accepted') {
        toast.success('Notställ installeras.')
        dismiss()
      } else if (outcome === 'dismissed') toast.info('Du kan installera senare under Inställningar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        data-testid="install-banner"
        role="region"
        aria-label="Installera appen"
        className="flex items-center gap-3 rounded-2xl bg-gold-500/10 px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(201,162,74,0.25)] animate-fade-in"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
          {ios ? <Smartphone className="size-5" aria-hidden="true" /> : <MonitorDown className="size-5" aria-hidden="true" />}
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ivory-100">
          {ios ? 'Installera Notställ på hemskärmen för offlineläge och säker lagring.' : 'Installera Notställ som app för offlineläge och ett eget fönster.'}
        </p>
        {ios ? (
          <Button variant="outline" size="sm" onClick={() => setShowHow(true)} className="shrink-0">
            Visa hur
          </Button>
        ) : (
          <Button size="sm" onClick={install} loading={busy} data-testid="install-app" className="shrink-0">
            Installera
          </Button>
        )}
        <IconButton label="Dölj" size="sm" onClick={dismiss} className="-mr-1 text-ivory-400">
          <X />
        </IconButton>
      </div>

      <Dialog
        open={showHow}
        onClose={() => setShowHow(false)}
        title="Lägg till på hemskärmen"
        description="Tar bara några sekunder – och biblioteket blir ditt eget, skyddat från Safaris rensning."
        size="sm"
        footer={<Button onClick={() => setShowHow(false)}>Jag förstår</Button>}
      >
        <IosInstallSteps />
        <p className="mt-4 text-xs leading-relaxed text-ivory-500">Obs: appen på hemskärmen har ett eget bibliotek. Importera dina noter där, eller ta en säkerhetskopia under Inställningar och läs in den i appen.</p>
      </Dialog>
    </>
  )
}
