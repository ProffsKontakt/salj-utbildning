// Shared import orchestration for the library: "Importera" (file picker →
// planImport → ImportDialog) and "Skanna" (ScanSheet → ImportDialog with one
// images item). The hook holds only data + handlers; <ImportOverlays> renders
// the dialogs and <ImportButtons> the two triggers.
import { useCallback, useMemo, useState } from 'react'
import { IMPORT_ACCEPT, useFilePicker } from '../../hooks/useFilePicker.js'
import { useToast } from '../ui/index.js'
import { planImport } from '../../lib/importScore.js'

let sessionCounter = 0

export function useImportFlow() {
  const { pickFiles } = useFilePicker()
  const toast = useToast()
  // { key, items: planImport items, enhance: boolean|null } while the dialog is open
  const [session, setSession] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)

  const busy = scanOpen || session !== null

  const startImport = useCallback(async () => {
    if (busy) return
    const files = await pickFiles({ accept: IMPORT_ACCEPT, multiple: true })
    if (!files.length) return // picker cancelled
    const items = planImport(files)
    if (!items.length) {
      toast.error('Inga filer som stöds valdes. Välj PDF, JPEG, PNG eller WebP.')
      return
    }
    setSession({ key: ++sessionCounter, items, enhance: null })
  }, [busy, pickFiles, toast])

  const startScan = useCallback(() => {
    if (busy) return
    setScanOpen(true)
  }, [busy])

  const closeScan = useCallback(() => setScanOpen(false), [])

  const finishScan = useCallback((files, { enhance } = {}) => {
    setScanOpen(false)
    if (!files?.length) return
    // Title left empty on purpose: the dialog falls back to defaultTitle(files).
    setSession({ key: ++sessionCounter, items: [{ kind: 'images', files, suggestedTitle: '' }], enhance: enhance ?? null })
  }, [])

  const closeSession = useCallback(() => setSession(null), [])

  return useMemo(
    () => ({ busy, session, scanOpen, startImport, startScan, closeScan, finishScan, closeSession }),
    [busy, session, scanOpen, startImport, startScan, closeScan, finishScan, closeSession],
  )
}
