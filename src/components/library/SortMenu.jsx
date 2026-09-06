import { ArrowUpDown, Check } from 'lucide-react'
import { Button, Menu } from '../ui/index.js'
import { SORT_OPTIONS } from './librarySort.js'

// Keeps menu labels aligned when only the active item shows a check mark.
function Blank(props) {
  return <span {...props} aria-hidden="true" />
}

/**
 * Sort picker; with `showFilter` it also carries the "Bara nedladdade" toggle
 * (cloud accounts only – device-only libraries are always fully downloaded).
 */
export function SortMenu({ value, onChange, showFilter = false, onlyDownloaded = false, onToggleDownloaded }) {
  const current = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0]
  const label = `Sortering: ${current.label}${onlyDownloaded ? ' · bara nedladdade' : ''}`
  const items = SORT_OPTIONS.map((o) => ({
    key: o.key,
    label: o.label,
    icon: o.key === current.key ? Check : Blank,
    onSelect: () => onChange(o.key),
  }))
  if (showFilter) {
    items.push(
      { separator: true },
      {
        key: 'onlyDownloaded',
        label: 'Bara nedladdade',
        icon: onlyDownloaded ? Check : Blank,
        hint: onlyDownloaded ? 'På' : 'Av',
        testId: 'library-filter-downloaded',
        onSelect: () => onToggleDownloaded?.(!onlyDownloaded),
      },
    )
  }
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <Button {...props} variant="secondary" size="md" data-testid="library-sort" aria-label={label} title={label} className="relative shrink-0 max-sm:w-11 max-sm:px-0">
          <ArrowUpDown className="size-[18px] text-gold-300" aria-hidden="true" />
          <span className="hidden sm:inline">{current.label}</span>
          {onlyDownloaded ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-gold-400 shadow-glow" aria-hidden="true" /> : null}
        </Button>
      )}
      items={items}
    />
  )
}
