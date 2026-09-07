import { useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { Button, Dialog, useToast } from '../ui/index.js'
import { useSync } from '../../lib/sync/useSync.js'
import { pluralize } from '../../lib/format.js'

/** Offered once after sign-in when the device holds notes created before the account existed. */
export function AdoptLocalDialog() {
  const sync = useSync()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const counts = sync.localOnly
  if (!sync.user || !counts) return null

  const upload = async () => {
    setBusy(true)
    try {
      const n = await sync.adoptLocal()
      toast.success(`${n} poster laddas upp till ditt konto`)
    } catch (err) {
      toast.error(err?.message || 'Kunde inte ladda upp.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && sync.keepLocal()}
      title="Ladda upp till ditt konto?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={sync.keepLocal} disabled={busy} data-testid="adopt-keep">
            Behåll bara här
          </Button>
          <Button onClick={upload} loading={busy} data-testid="adopt-upload">
            <CloudUpload className="size-4" /> Ladda upp
          </Button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-ivory-200">
        Den här enheten har {pluralize(counts.scores, 'stycke', 'stycken')}
        {counts.projects ? ` och ${pluralize(counts.projects, 'projekt', 'projekt')}` : ''} som skapades innan du loggade in. Vill du lägga dem i ditt konto så att de finns på alla dina enheter?
      </p>
    </Dialog>
  )
}
