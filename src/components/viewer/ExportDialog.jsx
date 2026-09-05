// Export a score as PDF (vector with baked-in annotations, or flattened page images).
import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { getAnnotationMap, getScoreFile } from '../../db/db.js'
import { buildExportPdf } from '../../lib/pdfEdit.js'
import { rasterizeToPdf } from '../../lib/pdfConvert.js'
import { saveFile, safeFileName } from '../../lib/download.js'
import { Dialog, Button, Toggle, useToast, cn } from '../ui/index.js'

function RadioCard({ checked, onSelect, title, description, name, testId }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition-colors', checked ? 'bg-gold-500/10 shadow-glow' : 'bg-ink-800 hover:bg-ink-700/70 hairline')}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" data-testid={testId} />
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

  const pageCount = score?.pageOrder?.length || 0

  const run = async () => {
    if (!score || busy) return
    if (!pageCount) {
      toast.error('Stycket har inga sidor att exportera.')
      return
    }
    setBusy(true)
    setProgress(null)
    try {
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
      // saveFile must stay in the same user-activation chain as the click.
      const result = await saveFile(bytes, safeFileName(score.title), 'application/pdf')
      if (result === 'shared') toast.success('Delad')
      else if (result === 'saved' || result === 'downloaded') toast.success('PDF exporterad')
      if (result !== 'cancelled') onClose?.()
    } catch (err) {
      toast.error(err?.message ? `Exporten misslyckades: ${err.message}` : 'Exporten misslyckades.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Exportera PDF"
      description={score ? `${score.title}${pageCount ? ` · ${pageCount} ${pageCount === 1 ? 'sida' : 'sidor'}` : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button onClick={run} loading={busy} data-testid="export-confirm">
            {!busy ? <FileDown className="size-4" /> : null}
            {busy && progress ? `Skapar… ${progress.done}/${progress.total}` : busy ? 'Skapar…' : 'Exportera'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-ink-800 px-4">
          <Toggle label="Inkludera anteckningar" description="Streck, överstrykningar och texter bakas in i PDF:en." checked={includeAnnotations} onChange={setIncludeAnnotations} disabled={busy} />
        </div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Format">
          <RadioCard
            name="export-mode"
            checked={mode === 'vector'}
            onSelect={() => setMode('vector')}
            title="PDF (vektor)"
            description="Behåller originalets skärpa och text. Sidordning och rotation följer med."
            testId="export-mode-vector"
          />
          <RadioCard
            name="export-mode"
            checked={mode === 'flat'}
            onSelect={() => setMode('flat')}
            title="PDF med sidor som bilder (platt)"
            description="Varje sida blir en bild. Fungerar alltid, även för skyddade filer, men blir större."
            testId="export-mode-flat"
          />
        </div>
        {busy ? (
          <div className="text-sm text-ivory-400" aria-live="polite">
            {progress ? `Renderar sida ${progress.done} av ${progress.total}…` : 'Bygger PDF…'}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
