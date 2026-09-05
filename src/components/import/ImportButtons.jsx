import { Camera, Upload } from 'lucide-react'
import { Button } from '../ui/index.js'

/** The two library import triggers, wired to a useImportFlow() result. */
export function ImportButtons({ flow, size = 'md' }) {
  return (
    <>
      <Button size={size} onClick={flow.startScan} disabled={flow.busy} data-testid="scan-button">
        <Camera className="size-[18px]" aria-hidden="true" />
        Skanna
      </Button>
      <Button variant="secondary" size={size} onClick={flow.startImport} disabled={flow.busy} data-testid="import-files">
        <Upload className="size-[18px]" aria-hidden="true" />
        Importera
      </Button>
    </>
  )
}
