// Menu item descriptors for "Lägg till sidor", shared by the body button and
// the top bar's overflow menu.
import { Camera, FolderOpen } from 'lucide-react'

/**
 * @param {{ onScan: () => void, onFiles: () => void, disabled?: boolean }} p
 */
export function addPagesItems({ onScan, onFiles, disabled = false }) {
  return [
    { key: 'scan', label: 'Skanna med kameran', icon: Camera, onSelect: onScan, disabled },
    { key: 'files', label: 'Från filer', icon: FolderOpen, onSelect: onFiles, disabled },
  ]
}
