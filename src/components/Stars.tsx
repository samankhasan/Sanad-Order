import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../lib/format'

/** Read-only stars (supports halves), e.g. 4.5 → ★★★★½ */
export function Stars({ value, className, size = 'size-3.5' }: { value: number; className?: string; size?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} dir="ltr" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.max(0, Math.min(1, value - i + 1))
        return (
          <span key={i} className={cn('relative inline-block', size)}>
            <Star className={cn('absolute inset-0 text-gray-300 dark:text-gray-600', size)} fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn('text-amber-400', size)} fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** Compact "★ 4.6 (12)" used on product cards */
export function RatingBadge({ avg, count, className }: { avg?: number | null; count?: number | null; className?: string }) {
  if (!count) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold', className)} dir="ltr">
      <Star className="size-3.5 text-amber-400" fill="currentColor" strokeWidth={0} />
      {Number(avg).toFixed(1)}
      <span className="font-semibold text-2">({count})</span>
    </span>
  )
}

/** Tap to choose 1–5 stars (44px touch targets, keyboard accessible) */
export function StarInput({ value, onChange, label, disabled }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5" dir="ltr" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}/5`} disabled={disabled}
          onMouseEnter={() => setHover(i)} onClick={() => onChange(i)}
          className="grid size-11 place-items-center rounded-xl transition active:scale-90 disabled:opacity-50">
          <Star className={cn('size-8 transition', i <= shown ? 'text-amber-400 drop-shadow-sm' : 'text-gray-300 dark:text-gray-600')} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  )
}
