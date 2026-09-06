import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Trash2, HardDrive } from 'lucide-react'
import { Button, Toggle, useToast, ConfirmDialog } from '../ui/index.js'
import { db } from '../../db/db.js'
import { useSetting } from '../../hooks/useSetting.js'
import { useSync } from '../../lib/sync/useSync.js'
import { formatBytes } from '../../lib/bytes.js'

/** Which scores are kept offline, and bulk download / removal. */
export function OfflineCard() {
  const sync = useSync()
  const toast = useToast()
  const [autoDownload, setAutoDownload] = useSetting('autoDownload')
  const [busy, setBusy] = useState(null) // 'download' | 'remove'
  const [confirmRemove, setConfirmRemove] = useState(false)
  const stats = useLiveQuery(
    async () => {
      const uid = sync.user?.id
      const all = uid ? await db.scores.where('ownerId').equals(uid).toArray() : []
      const have = new Set(await db.files.toCollection().primaryKeys())
      const downloaded = all.filter((s) => have.has(s.id))
      return { total: all.length, downloaded: downloaded.length, bytes: downloaded.reduce((n, s) => n + (s.fileSize || 0), 0) }
    },
    [sync.user?.id],
    null,
  )

  const downloadAll = async () => {
    setBusy('download')
    try {
      const n = await sync.downloadAll()
      toast.success(n ? `${n} stycken nedladdade` : 'Allt är redan nedladdat')
    } catch (err) {
      toast.error(err?.message || 'Nedladdningen misslyckades.')
    } finally {
      setBusy(null)
    }
  }

  const removeAll = async () => {
    setBusy('remove')
    try {
      const n = await sync.removeAllDownloads()
      setConfirmRemove(false)
      toast.success(`${n} nedladdningar borttagna`)
    } catch (err) {
      toast.error(err?.message || 'Kunde inte ta bort nedladdningar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-3xl bg-ink-850 p-5 shadow-stage sm:p-6" data-testid="offline-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-gold-500/10 text-gold-300">
          <HardDrive className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-2xl text-ivory-50">Offline på den här enheten</h2>
          <p className="text-sm text-ivory-400" data-testid="offline-summary">
            {stats ? `${stats.downloaded} av ${stats.total} stycken nedladdade · ${formatBytes(stats.bytes)}` : 'Räknar…'}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ivory-300">
        Nedladdade stycken fungerar utan internet – på scen, i repsalen, på tåget. Övriga syns i biblioteket och laddas ner när du öppnar dem online.
      </p>
      <div className="mt-3 rounded-2xl bg-ink-800 px-4">
        <Toggle label="Ladda ner automatiskt när jag öppnar ett stycke" description="Kräver internet första gången. Stäng av om du vill spara utrymme." checked={autoDownload} onChange={setAutoDownload} data-testid="setting-autoDownload" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={downloadAll} loading={busy === 'download'} disabled={!sync.online || !stats || stats.downloaded === stats.total} data-testid="download-all">
          <Download className="size-4" /> Ladda ner allt
        </Button>
        <Button variant="ghost" onClick={() => setConfirmRemove(true)} disabled={!stats || stats.downloaded === 0} data-testid="remove-all-downloads">
          <Trash2 className="size-4" /> Ta bort alla nedladdningar
        </Button>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={removeAll}
        loading={busy === 'remove'}
        title="Ta bort alla nedladdningar?"
        message="PDF-filerna tas bort från den här enheten. Noterna, anteckningarna och projekten finns kvar i molnet. Stycken med ändringar som inte synkats än behålls."
        confirmLabel="Ta bort"
      />
    </div>
  )
}
