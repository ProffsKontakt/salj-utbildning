// Floating bottom toolbar for drawing mode: tools, colours, widths, undo/redo, clear.
import { useState } from 'react'
import { Pen, Highlighter, Eraser, Type, Undo2, Redo2, Trash2, BookOpen, PenTool } from 'lucide-react'
import { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_WIDTHS, HIGHLIGHTER_WIDTHS, TEXT_SIZES } from '../../lib/annotationPaint.js'
import { IconButton, ConfirmDialog, cn } from '../ui/index.js'

const TOOLS = [
  { id: 'pen', label: 'Penna', icon: Pen, testId: 'tool-pen' },
  { id: 'highlighter', label: 'Överstrykning', icon: Highlighter, testId: 'tool-highlighter' },
  { id: 'eraser', label: 'Suddgummi', icon: Eraser, testId: 'tool-eraser' },
  { id: 'text', label: 'Text', icon: Type, testId: 'tool-text' },
]

function Swatch({ color, selected, onSelect, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-xl transition-[transform,background-color] active:scale-95',
        selected ? 'bg-ink-700 shadow-glow' : 'hover:bg-ink-700/70',
      )}
    >
      <span className={cn('block size-6 rounded-full', selected ? 'ring-2 ring-ivory-50 ring-offset-2 ring-offset-ink-800' : 'ring-1 ring-ivory-50/20')} style={{ backgroundColor: color }} />
    </button>
  )
}

function WidthOption({ width, selected, onSelect, tool }) {
  const dot = Math.min(22, Math.max(4, tool === 'highlighter' ? width * 1.1 : width * 4))
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Bredd ${width}`}
      title={`Bredd ${width}`}
      onClick={onSelect}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors', selected ? 'bg-ink-700 text-ivory-50 shadow-glow' : 'text-ivory-300 hover:bg-ink-700/70')}
    >
      <span className={cn('block bg-current', tool === 'highlighter' ? 'rounded-sm' : 'rounded-full')} style={tool === 'highlighter' ? { width: 20, height: dot } : { width: dot, height: dot }} />
    </button>
  )
}

function SizeOption({ size, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Textstorlek ${size}`}
      title={`Textstorlek ${size}`}
      onClick={onSelect}
      className={cn('flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 font-display leading-none transition-colors', selected ? 'bg-ink-700 text-ivory-50 shadow-glow' : 'text-ivory-300 hover:bg-ink-700/70')}
      style={{ fontSize: 12 + (size - 9) * 0.9 }}
    >
      A
    </button>
  )
}

const COLOR_NAMES = {
  '#1d4ed8': 'Blå',
  '#111827': 'Svart',
  '#b91c1c': 'Röd',
  '#15803d': 'Grön',
  '#7c3aed': 'Lila',
  '#c2410c': 'Orange',
  '#facc15': 'Gul',
  '#4ade80': 'Grön',
  '#f472b6': 'Rosa',
  '#60a5fa': 'Ljusblå',
  '#fb923c': 'Orange',
}

/**
 * @param {object} p
 * @param {string} p.tool  'pen'|'highlighter'|'eraser'|'text'
 * @param {(tool:string) => void} p.onToolChange
 * @param {object} p.settings  { penColor, penWidth, highlighterColor, highlighterWidth, textColor, textSize }
 * @param {(key:string, value:any) => void} p.onSettingChange
 * @param {boolean} p.penOnly
 * @param {(v:boolean) => void} p.onPenOnlyChange
 * @param {boolean} p.canUndo
 * @param {boolean} p.canRedo
 * @param {() => void} p.onUndo
 * @param {() => void} p.onRedo
 * @param {() => void} p.onClearPage
 * @param {boolean} p.canClear
 * @param {() => void} [p.onExit]   switch back to read mode
 * @param {string} [p.className]
 */
export function AnnotationToolbar({ tool, onToolChange, settings, onSettingChange, penOnly, onPenOnlyChange, canUndo, canRedo, onUndo, onRedo, onClearPage, canClear, onExit, className }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const colorKey = tool === 'highlighter' ? 'highlighterColor' : tool === 'text' ? 'textColor' : 'penColor'
  const colors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS
  const widthKey = tool === 'highlighter' ? 'highlighterWidth' : 'penWidth'
  const widths = tool === 'highlighter' ? HIGHLIGHTER_WIDTHS : PEN_WIDTHS
  const showColors = tool === 'pen' || tool === 'highlighter' || tool === 'text'
  const showWidths = tool === 'pen' || tool === 'highlighter'
  const showSizes = tool === 'text'

  return (
    <div className={cn('pointer-events-none flex w-full flex-col items-center gap-2 px-2', className)} role="toolbar" aria-label="Ritverktyg" data-testid="annotation-toolbar">
      {/* Colours + widths exceed a phone's width (6 swatches + 4 widths ≈ 470 px), so on small screens the row wraps instead of hiding options behind a scrollbar-less scroll. */}
      {showColors || showWidths || showSizes ? (
        <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto no-scrollbar rounded-2xl bg-ink-800/95 p-1 shadow-stage backdrop-blur animate-fade-in max-sm:flex-wrap max-sm:justify-center" key={tool}>
          {showColors ? (
            <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Färg">
              {colors.map((c) => (
                <Swatch key={c} color={c} label={COLOR_NAMES[c] || c} selected={settings[colorKey] === c} onSelect={() => onSettingChange(colorKey, c)} />
              ))}
            </div>
          ) : null}
          {showWidths ? (
            <>
              <span className="mx-1 h-6 w-px bg-ivory-50/10 max-sm:hidden" aria-hidden="true" />
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Bredd">
                {widths.map((w) => (
                  <WidthOption key={w} width={w} tool={tool} selected={settings[widthKey] === w} onSelect={() => onSettingChange(widthKey, w)} />
                ))}
              </div>
            </>
          ) : null}
          {showSizes ? (
            <>
              <span className="mx-1 h-6 w-px bg-ivory-50/10 max-sm:hidden" aria-hidden="true" />
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Textstorlek">
                {TEXT_SIZES.map((s) => (
                  <SizeOption key={s} size={s} selected={settings.textSize === s} onSelect={() => onSettingChange('textSize', s)} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* On phones the row wraps (the pen-only switch drops to a second line) instead of scrolling off-screen. */}
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto no-scrollbar rounded-2xl bg-ink-800/95 p-1 shadow-stage backdrop-blur max-sm:flex-wrap max-sm:justify-center">
        {onExit ? (
          <>
            <IconButton label="Läsläge" onClick={onExit} data-testid="tool-read">
              <BookOpen />
            </IconButton>
            <span className="mx-0.5 h-6 w-px bg-ivory-50/10 max-sm:hidden" aria-hidden="true" />
          </>
        ) : null}
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Verktyg">
          {TOOLS.map((t) => (
            <IconButton key={t.id} label={t.label} active={tool === t.id} onClick={() => onToolChange(t.id)} data-testid={t.testId} role="radio" aria-checked={tool === t.id}>
              <t.icon />
            </IconButton>
          ))}
        </div>
        <span className="mx-0.5 h-6 w-px bg-ivory-50/10 max-sm:hidden" aria-hidden="true" />
        <IconButton label="Ångra" onClick={onUndo} disabled={!canUndo} data-testid="undo">
          <Undo2 />
        </IconButton>
        <IconButton label="Gör om" onClick={onRedo} disabled={!canRedo} data-testid="redo">
          <Redo2 />
        </IconButton>
        <IconButton label="Rensa sidan" onClick={() => setConfirmClear(true)} disabled={!canClear} data-testid="clear-page">
          <Trash2 />
        </IconButton>
        <span className="mx-0.5 h-6 w-px bg-ivory-50/10 max-sm:hidden" aria-hidden="true" />
        <button
          type="button"
          role="switch"
          aria-checked={!!penOnly}
          onClick={() => onPenOnlyChange(!penOnly)}
          title={penOnly ? 'Endast penna: på – fingrar bläddrar' : 'Endast penna: av – fingrar ritar'}
          data-testid="pen-only-toggle"
          className={cn(
            'flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
            penOnly ? 'bg-gold-500/20 text-gold-300 shadow-glow' : 'text-ivory-400 hover:bg-ink-700/70 hover:text-ivory-200',
          )}
        >
          <PenTool className="size-4" />
          <span>Endast penna</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false)
          onClearPage()
        }}
        title="Rensa sidan?"
        message="Alla streck och texter på den här sidan tas bort. Du kan ångra direkt efteråt."
        confirmLabel="Rensa"
      />
    </div>
  )
}
