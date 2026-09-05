// "Lägg till sidor" entry point: a popover menu on a primary button.
import { Plus } from 'lucide-react'
import { Button, Menu } from '../ui/index.js'
import { addPagesItems } from './addPagesItems.js'

/**
 * Primary "Lägg till sidor" button that opens the two choices.
 * @param {object} p
 * @param {() => void} p.onScan
 * @param {() => void} p.onFiles
 * @param {boolean} [p.disabled]
 * @param {string} [p.className]
 * @param {'primary'|'secondary'|'outline'} [p.variant]
 * @param {'sm'|'md'|'lg'} [p.size]
 */
export function AddPagesMenu({ onScan, onFiles, disabled = false, className, variant = 'primary', size = 'md' }) {
  return (
    <Menu
      align="start"
      items={addPagesItems({ onScan, onFiles, disabled })}
      trigger={(props) => (
        <Button {...props} variant={variant} size={size} disabled={disabled} className={className} data-testid="add-pages">
          <Plus className="size-[18px]" aria-hidden="true" />
          Lägg till sidor
        </Button>
      )}
    />
  )
}
