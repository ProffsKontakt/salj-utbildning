import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, TriangleAlert } from 'lucide-react'
import { clearAllData } from '../../db/db.js'
import { Button, Dialog, TextField, useToast } from '../ui/index.js'
import { SettingsCard, Notice } from './SettingsCard.jsx'

const PHRASE = 'RADERA'

/** Irreversible actions: wipe the whole database. */
export function DangerZone() {
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const armed = typed.trim().toUpperCase() === PHRASE

  const close = () => {
    if (busy) return
    setOpen(false)
    setTyped('')
  }

  const wipe = async () => {
    if (!armed) return
    setBusy(true)
    try {
      await clearAllData()
      try {
        localStorage.removeItem('notstall.installBannerDismissed')
      } catch {
        /* ignore */
      }
      setOpen(false)
      setTyped('')
      toast.success('Allt innehåll har raderats.')
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error('Innehållet kunde inte raderas. Försök igen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard icon={TriangleAlert} title="Farozon" tone="danger" description="Åtgärder här kan inte ångras.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-ivory-300">Tar bort alla noter, anteckningar, projekt och inställningar från den här enheten. Ta en säkerhetskopia först om du vill kunna återställa något.</p>
        <Button variant="danger" onClick={() => setOpen(true)} data-testid="clear-data" className="shrink-0 self-start sm:self-auto">
          <Trash2 className="size-4" aria-hidden="true" />
          Rensa allt innehåll
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="Rensa allt innehåll?"
        description="Alla noter, anteckningar, projekt och inställningar på den här enheten raderas permanent."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Avbryt
            </Button>
            <Button variant="danger" onClick={wipe} disabled={!armed} loading={busy} data-testid="clear-data-confirm">
              Radera allt
            </Button>
          </>
        }
      >
        <Notice icon={TriangleAlert} tone="danger" className="mb-4">
          Detta kan inte ångras. Har du ingen säkerhetskopia är noterna borta för gott.
        </Notice>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            wipe()
          }}
        >
          <TextField
            label={`Skriv ${PHRASE} för att bekräfta`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={PHRASE}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            data-testid="clear-data-confirm-input"
            inputClassName="tracking-[0.2em] uppercase"
          />
        </form>
      </Dialog>
    </SettingsCard>
  )
}
