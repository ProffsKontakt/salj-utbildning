import { useState } from 'react'
import { MonitorDown, BadgeCheck, Smartphone } from 'lucide-react'
import { isIOS, isStandalone } from '../../lib/platform.js'
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js'
import { Button, useToast } from '../ui/index.js'
import { SettingsCard, Notice } from './SettingsCard.jsx'
import { IosInstallSteps } from './IosInstallSteps.jsx'

/** Install status and guidance for the current platform. */
export function InstallCard() {
  const toast = useToast()
  const { canInstall, installed, prompt } = useInstallPrompt()
  const [busy, setBusy] = useState(false)
  const standalone = isStandalone()

  const install = async () => {
    setBusy(true)
    try {
      const outcome = await prompt()
      if (outcome === 'accepted') toast.success('Notställ installeras. Öppna appen från hemskärmen eller Start-menyn.')
      else if (outcome === 'dismissed') toast.info('Installationen avbröts. Du kan installera senare härifrån.')
      else toast.info('Installera via webbläsarens meny (”Installera app” eller ”Lägg till på hemskärmen”).')
    } finally {
      setBusy(false)
    }
  }

  let body
  if (standalone || installed) {
    body = (
      <Notice icon={BadgeCheck} tone="success" data-testid="install-status">
        <span className="text-[15px] text-ivory-50">Appen är installerad ✓</span>
        <div className="mt-0.5 text-ivory-300">Notställ fungerar offline och har sitt eget, skyddade bibliotek på den här enheten.</div>
      </Notice>
    )
  } else if (isIOS()) {
    body = (
      <div>
        <p className="mb-4 text-[13px] leading-relaxed text-ivory-300">
          Lägg till Notställ på hemskärmen så öppnas den i helskärm, fungerar offline och får ett eget bibliotek som Safari inte rensar.
        </p>
        <IosInstallSteps />
      </div>
    )
  } else if (canInstall) {
    body = (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-ivory-300">Installera Notställ som en egen app: eget fönster, offlineläge och plats på hemskärmen eller i Dock/Start-menyn.</p>
        <Button onClick={install} loading={busy} data-testid="install-app" className="shrink-0">
          <MonitorDown className="size-4" aria-hidden="true" />
          Installera
        </Button>
      </div>
    )
  } else {
    body = (
      <Notice icon={Smartphone} tone="info">
        Installera via webbläsarens meny: i Chrome och Edge heter det ”Installera app” eller ”Lägg till på startskärmen”, i Safari på Mac ”Lägg till i Dock”. Då fungerar Notställ
        offline och öppnas i ett eget fönster.
      </Notice>
    )
  }

  return (
    <SettingsCard icon={MonitorDown} title="Installera appen" description="Som installerad app fungerar Notställ offline och öppnas i helskärm.">
      {body}
    </SettingsCard>
  )
}
