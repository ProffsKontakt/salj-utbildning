import { Music } from 'lucide-react'
import { useObjectUrl } from '../../hooks/useObjectUrl.js'
import { cn } from '../ui/cn.js'

/** Small decorative thumbnail of a score's first page (falls back to a note glyph). */
export function ScoreThumb({ score, className, iconClassName = 'size-4' }) {
  const url = useObjectUrl(score?.thumb, score?.thumbMime || 'image/jpeg')
  return (
    <div className={cn('paper relative shrink-0 overflow-hidden', className)} aria-hidden="true">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover object-top" draggable={false} loading="lazy" decoding="async" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-400">
          <Music className={cn('opacity-70', iconClassName)} />
        </div>
      )}
    </div>
  )
}
