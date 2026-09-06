import { useState } from 'react'
import { Archive, ArrowDownToLine, ArrowUpFromLine, Save, TriangleAlert } from 'lucide-react'
import { exportBackup, importBackup, readBackupManifest, backupFileName, BACKUP_MIME } from '../../lib/backup.js'
import { saveFile } from '../../lib/download.js'
import { formatBytes } from '../../lib/bytes.js'
import { pluralize, todayIso } from '../../lib/format.js'
import { isIOS } from '../../lib/platform.js'
import { useFilePicker } from '../../hooks/useFilePicker.js'
import { useHoldReload } from '../../hooks/useHoldReload.js'
import { Button, Dialog, useToast, cn } from '../ui/index.js'
import { SettingsCard, Notice } from './SettingsCard.jsx'

function formatExportedAt(iso) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return 'okänt datum'
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeStyle: 'short' }).format(d)
}

const MODES = [
  {
    value: 'merge',
    title: 'Lägg till i biblioteket',
    description: 'Behåller allt du har nu. Stycken som redan finns (samma id) uppdateras från kopian.',
    testId: 'import-backup-mode-merge',
  },
  {
    value: 'replace',
    title: 'Ersätt allt',
    description: 'Raderar hela det nuvarande biblioteket, projekten och inställningarna innan kopian läses in.',
    testId: 'import-backup-mode-replace',
    danger: true,
  },
]

/** Export / import the whole library as a zip file. */
export function BackupCard() {
  const toast = useToast()
  const { pickFiles } = useFilePicker()

  // export
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total, label }
  const [ready, setReady] = useState(null) // { blob, name } – built but not yet saved (iOS second tap / retry)

  // import
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState(null) // { file, counts, exportedAt }
  const [mode, setMode] = useState('merge')
  const [importing, setImporting] = useState(false)

  // A backup being built/restored or waiting for a tap must not be lost to an app-update reload.
  useHoldReload(exporting || importing || ready !== null || pending !== null)

  const save = async (blob, name) => {
    const result = await saveFile(blob, name, BACKUP_MIME)
    if (result === 'cancelled') {
      setReady({ blob, name })
      toast.info('Delningen avbröts. Du kan spara kopian igen härifrån.')
      return
    }
    if (result === 'failed') {
      setReady({ blob, name })
      toast.error('Delningen misslyckades. Tryck på Spara för att försöka igen.')
      return
    }
    setReady(null)
    toast.success(result === 'shared' ? 'Säkerhetskopian delades.' : 'Säkerhetskopian sparades.')
  }

  const doExport = async () => {
    setExporting(true)
    setReady(null)
    setProgress({ done: 0, total: 1, label: 'Förbereder…' })
    const started = Date.now()
    try {
      const { blob, counts, skipped } = await exportBackup({ onProgress: setProgress })
      const name = backupFileName(todayIso())
      if (skipped.length) toast.info(`${pluralize(skipped.length, 'stycke är inte nedladdat', 'stycken är inte nedladdade')} och togs inte med: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`, { duration: 7000 })
      if (counts.scores === 0 && counts.projects === 0) toast.info('Biblioteket är tomt – kopian innehåller bara inställningar.')
      // The share sheet on iOS needs a fresh user gesture; if packing took long
      // the original tap has expired, so hand the user a Save button instead.
      if (isIOS() && Date.now() - started > 2500) {
        setReady({ blob, name })
        toast.info('Säkerhetskopian är klar – tryck på Spara.')
      } else {
        await save(blob, name)
      }
    } catch (err) {
      console.error(err)
      toast.error('Säkerhetskopian kunde inte skapas. Kontrollera att det finns ledigt utrymme och försök igen.')
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const pickBackup = async () => {
    setPicking(true)
    try {
      const [file] = await pickFiles({ accept: 'application/zip,.zip', multiple: false })
      if (!file) return
      const { counts, exportedAt } = await readBackupManifest(file)
      setMode('merge')
      setPending({ file, counts, exportedAt })
    } catch (err) {
      toast.error(err?.code === 'INVALID_BACKUP' ? err.message : 'Filen kunde inte läsas. Välj en säkerhetskopia från Notställ (.zip).')
    } finally {
      setPicking(false)
    }
  }

  const doImport = async () => {
    if (!pending) return
    setImporting(true)
    try {
      const result = await importBackup(pending.file, mode)
      // pdf.js is lazy-loaded (only the viewer needs it), so it must not be a static
      // import here or the settings page would pull the whole library in eagerly. If it
      // was loaded this session the LRU cache may hold stale documents for the scores
      // the backup just replaced; otherwise this is a no-op.
      await import('../../lib/pdf.js')
        .then((m) => {
          for (const id of result.scoreIds) m.invalidateScoreDocument(id)
        })
        .catch(() => {})
      setPending(null)
      const parts = [pluralize(result.scores, 'stycke', 'stycken'), pluralize(result.projects, 'projekt', 'projekt')]
      toast.success(`${mode === 'replace' ? 'Biblioteket ersattes' : 'Säkerhetskopian lästes in'}: ${parts.join(', ')}.`)
      if (result.skipped.length) toast.info(`${pluralize(result.skipped.length, 'stycke', 'stycken')} saknade PDF-fil i kopian och hoppades över.`, { duration: 7000 })
    } catch (err) {
      console.error(err)
      toast.error(err?.code === 'INVALID_BACKUP' ? err.message : 'Säkerhetskopian kunde inte läsas in. Inget har ändrats.')
    } finally {
      setImporting(false)
    }
  }

  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <SettingsCard icon={Archive} title="Säkerhetskopia" description="Hela biblioteket – nedladdade noter, anteckningar, projekt och inställningar – som en zip-fil du kan spara i Filer, iCloud eller på en dator. Stycken som bara finns i molnet tas inte med.">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button onClick={doExport} loading={exporting} data-testid="export-backup" className="sm:min-w-[15.5rem] sm:flex-1">
          {!exporting ? <ArrowDownToLine className="size-4" aria-hidden="true" /> : null}
          {exporting ? 'Packar…' : 'Exportera säkerhetskopia'}
        </Button>
        <Button variant="secondary" onClick={pickBackup} loading={picking} disabled={exporting || importing} data-testid="import-backup" className="sm:min-w-[15.5rem] sm:flex-1">
          {!picking ? <ArrowUpFromLine className="size-4" aria-hidden="true" /> : null}
          Importera säkerhetskopia
        </Button>
      </div>

      {progress ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ivory-300">{progress.label}</span>
            <span className="shrink-0 text-ivory-400">
              {Math.min(progress.done, progress.total)} / {progress.total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Exportförlopp">
            <div className="h-full rounded-full bg-gold-400 transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-ink-800 p-3.5 sm:flex-row sm:items-center sm:justify-between" data-testid="backup-ready">
          <div className="min-w-0 text-[13px] leading-relaxed text-ivory-200">
            <div className="truncate text-ivory-50">{ready.name}</div>
            <div className="text-ivory-400">Klar att sparas · {formatBytes(ready.blob.size)}</div>
          </div>
          <Button size="sm" onClick={() => save(ready.blob, ready.name).catch(() => toast.error('Kopian kunde inte sparas.'))} className="shrink-0">
            <Save className="size-4" aria-hidden="true" />
            Spara
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-ivory-500">
        Ta en kopia innan du byter enhet, raderar appen eller rensar webbläsardata. På iPhone och iPad öppnas delningsmenyn – välj ”Spara i Filer”. Inlästa stycken hamnar
        ”bara här” på enheten tills du laddar upp dem till ditt konto.
      </p>

      <Dialog
        open={!!pending}
        onClose={importing ? undefined : () => setPending(null)}
        title="Importera säkerhetskopia"
        description={pending ? `Innehåller ${pluralize(pending.counts.scores, 'stycke', 'stycken')}, ${pluralize(pending.counts.projects, 'projekt', 'projekt')}, exporterad ${formatExportedAt(pending.exportedAt)}.` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={importing}>
              Avbryt
            </Button>
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={doImport} loading={importing} data-testid="import-backup-confirm">
              {mode === 'replace' ? 'Ersätt allt' : 'Lägg till'}
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Importläge" className="flex flex-col gap-2">
          {MODES.map((m) => {
            const selected = mode === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={m.testId}
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-[background-color,box-shadow]',
                  selected ? (m.danger ? 'bg-velvet-500/15 shadow-[inset_0_0_0_1px_rgba(163,64,90,0.6)]' : 'bg-gold-500/10 shadow-glow') : 'bg-ink-800 hairline hover:bg-ink-700',
                )}
              >
                <span
                  className={cn(
                    'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? (m.danger ? 'border-[#f08a86]' : 'border-gold-400') : 'border-ivory-500',
                  )}
                  aria-hidden="true"
                >
                  {selected ? <span className={cn('size-2 rounded-full', m.danger ? 'bg-[#f08a86]' : 'bg-gold-400')} /> : null}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[15px]', m.danger ? 'text-[#f5a6a2]' : 'text-ivory-50')}>{m.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ivory-400">{m.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        {mode === 'replace' ? (
          <Notice icon={TriangleAlert} tone="danger" className="mt-3">
            Allt som finns i appen nu försvinner och går inte att återställa utan en annan säkerhetskopia.
          </Notice>
        ) : null}
      </Dialog>
    </SettingsCard>
  )
}
