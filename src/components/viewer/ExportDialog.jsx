// Export a score as PDF (vector with baked-in annotations, or flattened page images).
import { useState } from 'react'
import { FileDown, Save } from 'lucide-react'
import { getAnnotationMap, getScoreFile } from '../../db/db.js'
import { buildExportPdf } from '../../lib/pdfEdit.js'
import { rasterizeToPdf } from '../../lib/pdfConvert.js'
import { saveFile, safeFileName } from '../../lib/download.js'
import { formatBytes } from '../../lib/bytes.js'
import { isIOS } from '../../lib/platform.js'
import { Dialog, Button, Toggle, useToast, cn } from '../ui/index.js'

function RadioCard({ checked, onSelect, title, description, name, testId, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition-colors', checked ? 'bg-gold-500/10 shadow-glow' : 'bg-ink-800 hover:bg-ink-700/70 hairline')}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} disabled={disabled} className="peer sr-only" data-testid={testId} />
      <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-gold-400' : 'border-ivory-400')} aria-hidden="true">
        {checked ? <span className="block size-2.5 rounded-full bg-gold-400" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] text-ivory-50">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ivory-400">{description}</span>
      </span>
    </label>
  )
}

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {object} p.score
 * @param {object|null} p.doc   pdf.js document (needed for the flattened variant)
 */
export function ExportDialog({ open, onClose, score, doc }) {
  const toast = useToast()
  const [includeAnnotations, setIncludeAnnotations] = useState(true)
  const [mode, setMode] = useState('vector')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }
  // Built but not yet saved (iOS): the share sheet needs a fresh tap, see below.
  const [ready, setReady] = useState(null) // { bytes, name }

  const pageCount = score?.pageOrder?.length || 0

  // Drop any built file when the dialog closes so a reopen starts clean.
  const close = () => {
    setReady(null)
    onClose?.()
  }

  const changeOptions = (apply) => {
    setReady(null) // options changed → the built bytes are stale
    apply()
  }

  /** Report a saveFile result. Returns true when the dialog should close. */
  const report = (result) => {
    if (result === 'shared') toast.success('Delad')
    else if (result === 'saved' || result === 'downloaded') toast.success('PDF exporterad')
    else if (result === 'failed') toast.error('PDF:en kunde inte sparas. Försök igen.')
    return result === 'shared' || result === 'saved' || result === 'downloaded'
  }

  const build = async () => {
    const file = await getScoreFile(score.id)
    if (!file?.data) throw new Error('Notfilen hittades inte.')
    const annotations = await getAnnotationMap(score.id)
    const base = { pageOrder: score.pageOrder, rotations: score.rotations || {} }
    let bytes
    let flattened = mode === 'flat'
    if (!flattened) {
      try {
        bytes = await buildExportPdf({
          srcBytes: file.data,
          ...base,
          annotations,
          includeAnnotations,
          title: score.title,
          author: score.composer || '',
        })
      } catch (err) {
        if (err?.code === 'ENCRYPTED') flattened = true
        else throw err
      }
    }
    if (flattened) {
      if (!doc) throw new Error('Dokumentet är inte laddat ännu. Försök igen om en stund.')
      bytes = await rasterizeToPdf(doc, { ...base, annotations: includeAnnotations ? annotations : null, onProgress: (done, total) => setProgress({ done, total }) })
    }
    return bytes
  }

  const run = async () => {
    if (!score || busy) return
    if (!pageCount) {
      toast.error('Stycket har inga sidor att exportera.')
      return
    }
    setBusy(true)
    setProgress(null)
    setReady(null)
    try {
      const bytes = await build()
      const name = safeFileName(score.title)
      if (isIOS()) {
        // Web Share needs transient user activation. Building the PDF (pdf-lib
        // copy, or rasterizing every page) takes long enough for the original
        // tap to expire, and the <a download> fallback does not work in installed
        // home-screen apps – so hand the user a "Spara PDF" button instead.
        setReady({ bytes, name })
      } else {
        // Anchor download does not depend on activation; save right away.
        if (report(await saveFile(bytes, name, 'application/pdf'))) onClose?.()
      }
    } catch (err) {
      toast.error(err?.message ? `Exporten misslyckades: ${err.message}` : 'Exporten misslyckades.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  // Runs directly in the tap handler: no awaits before saveFile so the share
  // sheet opens inside the user-activation window.
  const save = () => {
    if (!ready || busy) return
    setBusy(true)
    saveFile(ready.bytes, ready.name, 'application/pdf')
      .then((result) => {
        if (report(result)) {
          setReady(null)
          onClose?.()
        } else if (result === 'cancelled') {
          toast.info('Delningen avbröts. Du kan spara PDF:en igen härifrån.')
        }
      })
      .catch(() => toast.error('PDF:en kunde inte sparas. Försök igen.'))
      .finally(() => setBusy(false))
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : close}
      title="Exportera PDF"
      description={score ? `${score.title}${pageCount ? ` · ${pageCount} ${pageCount === 1 ? 'sida' : 'sidor'}` : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Avbryt
          </Button>
          {ready ? (
            <Button onClick={save} loading={busy} data-testid="export-confirm">
              {!busy ? <Save className="size-4" /> : null}
              Spara PDF
            </Button>
          ) : (
            <Button onClick={run} loading={busy} data-testid="export-confirm">
              {!busy ? <FileDown className="size-4" /> : null}
              {busy && progress ? `Skapar… ${progress.done}/${progress.total}` : busy ? 'Skapar…' : 'Exportera'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-ink-800 px-4">
          <Toggle label="Inkludera anteckningar" description="Streck, överstrykningar och texter bakas in i PDF:en." checked={includeAnnotations} onChange={(v) => changeOptions(() => setIncludeAnnotations(v))} disabled={busy} />
        </div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Format">
          <RadioCard
            name="export-mode"
            checked={mode === 'vector'}
            onSelect={() => changeOptions(() => setMode('vector'))}
            title="PDF (vektor)"
            description="Behåller originalets skärpa och text. Sidordning och rotation följer med."
            testId="export-mode-vector"
            disabled={busy}
          />
          <RadioCard
            name="export-mode"
            checked={mode === 'flat'}
            onSelect={() => changeOptions(() => setMode('flat'))}
            title="PDF med sidor som bilder (platt)"
            description="Varje sida blir en bild. Fungerar alltid, även för skyddade filer, men blir större."
            testId="export-mode-flat"
            disabled={busy}
          />
        </div>
        {busy && !ready ? (
          <div className="text-sm text-ivory-400" aria-live="polite">
            {progress ? `Renderar sida ${progress.done} av ${progress.total}…` : 'Bygger PDF…'}
          </div>
        ) : null}
        {ready ? (
          <div className="rounded-2xl bg-ink-800 p-3.5 text-[13px] leading-relaxed text-ivory-200" data-testid="export-ready" aria-live="polite">
            <div className="truncate text-ivory-50">{ready.name}</div>
            <div className="text-ivory-400">Klar att sparas · {formatBytes(ready.bytes.byteLength ?? ready.bytes.length ?? 0)}. Tryck på Spara PDF – välj ”Spara i Filer” eller dela.</div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
