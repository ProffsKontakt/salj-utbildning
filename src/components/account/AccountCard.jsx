import { useEffect, useState } from 'react'
import { CloudCheck, CloudOff, CloudUpload, LogOut, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button, Dialog, Toggle, useToast, cn } from '../ui/index.js'
import { useSync } from '../../lib/sync/useSync.js'
import { formatTimestamp } from '../../lib/format.js'

function StatusLine({ status, online }) {
  if (!online) return <span className="inline-flex items-center gap-1.5 text-ivory-300"><CloudOff className="size-4" /> Offline – ändringar sparas och synkas när du är online igen</span>
  if (status.phase === 'syncing') {
    const p = status.progress
    return (
      <span className="inline-flex items-center gap-1.5 text-gold-200">
        <RefreshCw className="size-4 animate-spin-slow" /> Synkar…{p?.kind === 'push' && p.total ? ` (${p.done}/${p.total})` : ''}
      </span>
    )
  }
  if (status.phase === 'error') return <span className="inline-flex items-center gap-1.5 text-[#f08a86]"><AlertTriangle className="size-4" /> {status.error || 'Synkfel'}</span>
  if (status.pending > 0) return <span className="inline-flex items-center gap-1.5 text-ivory-200"><CloudUpload className="size-4" /> {status.pending} ändringar väntar</span>
  return <span className="inline-flex items-center gap-1.5 text-success"><CloudCheck className="size-4" /> Allt är synkat{status.lastSyncAt ? ` · ${formatTimestamp(status.lastSyncAt)}` : ''}</span>
}

export function AccountCard() {
  const sync = useSync()
  const toast = useToast()
  const { user, status, online } = sync
  const [confirm, setConfirm] = useState(false)
  const [clearDevice, setClearDevice] = useState(true)
  const [unsynced, setUnsynced] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!confirm) return
    sync.countUnsynced().then(setUnsynced)
  }, [confirm, sync])

  const signOut = async () => {
    setBusy(true)
    try {
      await sync.signOut({ clearDevice })
      setConfirm(false)
      toast.success('Utloggad')
    } catch (err) {
      toast.error(err?.message || 'Kunde inte logga ut.')
    } finally {
      setBusy(false)
    }
  }

  const providerLabel = user.provider === 'google' ? 'Google' : user.provider === 'apple' ? 'Apple' : 'E-post'

  return (
    <div className="rounded-3xl bg-ink-850 p-5 shadow-stage sm:p-6" data-testid="account-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-3xl text-ivory-50">Ditt konto</h2>
          <p className="mt-1 truncate text-[15px] text-ivory-200" data-testid="account-email">
            {user.name ? `${user.name} · ` : ''}
            {user.email}
          </p>
          <p className="text-xs text-ivory-500">Inloggad med {providerLabel}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-ink-800 px-4 py-3 text-sm" data-testid="sync-status" data-phase={status.phase} data-pending={status.pending}>
        <StatusLine status={status} online={online} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => sync.syncNow()} disabled={!online || status.phase === 'syncing'} data-testid="sync-now">
          <RefreshCw className={cn('size-4', status.phase === 'syncing' && 'animate-spin-slow')} /> Synka nu
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(true)} data-testid="sign-out">
          <LogOut className="size-4" /> Logga ut
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Logga ut?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Avbryt
            </Button>
            <Button variant={clearDevice ? 'danger' : 'primary'} onClick={signOut} loading={busy} data-testid="sign-out-confirm">
              Logga ut
            </Button>
          </>
        }
      >
        {unsynced > 0 ? (
          <p className="mb-3 rounded-xl bg-velvet-600/30 px-3 py-2 text-sm text-ivory-100" role="alert">
            {unsynced} ändringar är inte uppladdade ännu. Vänta tills allt är synkat, annars går de förlorade om du rensar enheten.
          </p>
        ) : null}
        <div className="rounded-2xl bg-ink-800 px-4">
          <Toggle
            label="Rensa noterna från den här enheten"
            description="Rekommenderas på delade enheter. Dina noter finns kvar i molnet och laddas ner igen när du loggar in."
            checked={clearDevice}
            onChange={setClearDevice}
            data-testid="sign-out-clear"
          />
        </div>
      </Dialog>
    </div>
  )
}
