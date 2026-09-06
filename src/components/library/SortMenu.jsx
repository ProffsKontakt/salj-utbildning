import { ArrowUpDown, Check } from 'lucide-react'
import { Button, Menu } from '../ui/index.js'
import { SORT_OPTIONS } from './librarySort.js'

// Keeps menu labels aligned when only the active item shows a check mark.
function Blank(props) {
  return <span {...props} aria-hidden="true" />
}

export function SortMenu({ value, onChange }) {
  const current = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0]
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <Button {...props} variant="secondary" size="md" data-testid="library-sort" aria-label={`Sortering: ${current.label}`} title={`Sortering: ${current.label}`} className="shrink-0 max-sm:w-11 max-sm:px-0">
          <ArrowUpDown className="size-[18px] text-gold-300" aria-hidden="true" />
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      )}
      items={SORT_OPTIONS.map((o) => ({
        key: o.key,
        label: o.label,
        icon: o.key === current.key ? Check : Blank,
        onSelect: () => onChange(o.key),
      }))}
    />
  )
}
