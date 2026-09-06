import { ImportDialog } from './ImportDialog.jsx'
import { ScanSheet } from './ScanSheet.jsx'

/** Renders the scan sheet and the import dialog for a useImportFlow() result. */
export function ImportOverlays({ flow }) {
  const { session } = flow
  return (
    <>
      <ScanSheet open={flow.scanOpen} onClose={flow.closeScan} onDone={flow.finishScan} />
      {session ? <ImportDialog key={session.key} open items={session.items} initialEnhance={session.enhance} onClose={flow.closeSession} /> : null}
    </>
  )
}
