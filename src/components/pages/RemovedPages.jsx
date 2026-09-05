// Collapsible list of hidden (removed) source pages with a restore action.
import { useState } from 'react'
import { ChevronDown, EyeOff, Undo2 } from 'lucide-react'
import { PageThumb } from './PageThumb.jsx'
import { Button } from '../ui/index.js'
import { cn } from '../ui/cn.js'

const THUMB_W = 72
const THUMB_H = 96

/**
 * @param {object} p
 * @param {object|null} p.doc
 * @param {number[]} p.removed        source indices not in pageOrder
 * @param {Record<number,number>} p.rotations
 * @param {{current: Element|null}} p.scrollRoot
 * @param {(srcIndex:number)=>void} p.onRestore
 * @param {boolean} [p.disabled]
 */
export function RemovedPages({ doc, removed, rotations, scrollRoot, onRestore, disabled = false }) {
  const [open, setOpen] = useState(true)
  if (!removed.length) return null
  const n = removed.length
  return (
    <section data-testid="removed-pages" aria-label="Borttagna sidor" className="rounded-3xl bg-ink-850/80 hairline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition-colors hover:bg-ink-800/70 sm:px-5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-700 text-ivory-300">
          <EyeOff className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl leading-tight text-ivory-50">
            Borttagna sidor <span className="text-ivory-400">({n})</span>
          </span>
          <span className="block text-[13px] text-ivory-400">Sidan göms – den finns kvar i filen och kan återställas när som helst.</span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-ivory-400 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <ul className="flex flex-col gap-2 border-t border-ivory-50/8 px-3 py-3 sm:px-4">
          {removed.map((srcIndex) => (
            <li key={srcIndex} data-testid="removed-page" data-source-index={srcIndex} className="flex items-center gap-3 rounded-2xl bg-ink-800/60 p-2 pr-3 animate-fade-in">
              <div className="shrink-0 overflow-hidden rounded-lg bg-ink-950/60 p-1">
                <PageThumb doc={doc} pageIndex={srcIndex} rotation={rotations[srcIndex] || 0} width={THUMB_W} height={THUMB_H} root={scrollRoot} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ivory-50">Sida {srcIndex + 1} i filen</p>
                <p className="text-xs text-ivory-500">Dold i visaren</p>
              </div>
              <Button variant="outline" size="sm" className="h-11 shrink-0" onClick={() => onRestore(srcIndex)} disabled={disabled} data-testid="restore-page" aria-label={`Återställ sida ${srcIndex + 1}`}>
                <Undo2 className="size-4" aria-hidden="true" />
                Återställ
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
