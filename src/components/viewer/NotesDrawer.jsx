// Notes: a side panel on md+ screens, a bottom sheet on phones. Holds the per-page
// note (saved with the annotation record) and the free text about the whole score.
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { IconButton, TextArea, cn } from '../ui/index.js'

/**
 * Local draft that follows an external value until the user types, then reports
 * changes debounced. Keeps typing snappy while the source of truth is async.
 */
function useDraft(value, onCommit, delay = 400) {
  // base: the external value the draft was last synced with; committed: the last
  // text handed to onCommit (the source of truth catches up with it asynchronously).
  const [draft, setDraft] = useState({ base: value, text: value, committed: value })
  const timer = useRef(0)
  const onCommitRef = useRef(onCommit)
  const valueRef = useRef(value)
  useEffect(() => {
    onCommitRef.current = onCommit
    valueRef.current = value
  }, [onCommit, value])
  // Adopt a new external value only when nothing is pending and the value is neither the
  // one we started from (the write has not landed yet) nor the one we wrote (it just did).
  // Otherwise the textarea would snap back to the stale prop right after each commit.
  const pending = draft.text !== draft.committed
  const external = value !== draft.base && value !== draft.committed
  const text = !pending && external ? value : draft.text
  const pendingRef = useRef(null) // text typed but not yet committed
  const change = (next) => {
    setDraft((d) => ({ base: value, text: next, committed: d.committed }))
    pendingRef.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pendingRef.current = null
      onCommitRef.current?.(next)
      setDraft((d) => ({ base: valueRef.current, text: d.text, committed: next }))
    }, delay)
  }
  // Flush a pending edit on unmount instead of dropping it.
  useEffect(() => {
    const t = timer
    return () => {
      clearTimeout(t.current)
      if (pendingRef.current !== null) {
        const v = pendingRef.current
        pendingRef.current = null
        onCommitRef.current?.(v)
      }
    }
  }, [])
  return [text, change]
}

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {number} p.pageNumber       1-based display position
 * @param {string} p.pageNote
 * @param {(note:string) => void} p.onPageNoteChange
 * @param {string} p.scoreNotes
 * @param {(notes:string) => void} p.onScoreNotesChange
 * @param {'side'|'sheet'} p.variant
 */
export function NotesDrawer({ open, onClose, pageNumber, pageNote = '', onPageNoteChange, scoreNotes = '', onScoreNotesChange, variant = 'side', className }) {
  // The page note is controlled directly by the annotation editor (synchronous state,
  // debounced + flushed by the editor itself), so a quick page turn can never misfile it.
  const [aboutText, setAboutText] = useDraft(scoreNotes, onScoreNotesChange, 500)
  if (!open) return null

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
      <TextArea
        label={`Anteckning för sida ${pageNumber}`}
        value={pageNote}
        onChange={(e) => onPageNoteChange?.(e.target.value)}
        rows={4}
        placeholder="T.ex. andas här, tempo ned, blicken mot dirigenten…"
        data-testid="page-note"
      />
      <TextArea label="Om stycket" value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={5} placeholder="Tonart, tempo, tolkning, källa…" data-testid="score-notes" />
    </div>
  )

  if (variant === 'sheet') {
    return (
      <div className={cn('pb-safe absolute inset-x-0 bottom-0 z-40 flex max-h-[60dvh] flex-col rounded-t-3xl bg-ink-850 text-ivory-100 shadow-stage animate-slide-up', className)} role="region" aria-label="Anteckningar" data-testid="notes-drawer">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <span className="mx-auto block h-1 w-10 rounded-full bg-ivory-50/15" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="font-display text-2xl text-ivory-50">Anteckningar</h2>
          <IconButton label="Stäng anteckningar" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </div>
        {body}
      </div>
    )
  }

  return (
    <aside className={cn('flex h-full w-80 shrink-0 flex-col border-l border-ivory-50/8 bg-ink-900/80 text-ivory-100 backdrop-blur', className)} aria-label="Anteckningar" data-testid="notes-drawer">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="font-display text-2xl text-ivory-50">Anteckningar</h2>
        <IconButton label="Stäng anteckningar" size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {body}
    </aside>
  )
}
