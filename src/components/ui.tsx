import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Minus, Plus, RefreshCw } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { assetUrl, cn, thumbOf } from '../lib/format'
import type { Category, OrderStatus } from '../lib/types'
import { haptic, pushBackHandler } from '../lib/native'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin', className)} />
}

export function BackButton({ to }: { to?: string }) {
  const nav = useNavigate()
  const { dir } = usePrefs()
  const Icon = dir === 'rtl' ? ArrowRight : ArrowLeft
  return (
    <button aria-label="back" onClick={() => (to ? nav(to) : window.history.length > 1 ? nav(-1) : nav('/'))} className="icon-btn -ms-2">
      <Icon className="size-6" />
    </button>
  )
}

function useScrolled() {
  const [s, setS] = useState(false)
  useEffect(() => {
    const f = () => setS(window.scrollY > 4)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  return s
}

export function PageHeader({ title, back, right, subtitle, wide }: { title: ReactNode; back?: boolean | string; right?: ReactNode; subtitle?: ReactNode; wide?: boolean }) {
  const scrolled = useScrolled()
  return (
    <header className="app-bar no-print" data-scrolled={scrolled}>
      <div className={cn(wide ? 'page' : 'page-narrow', 'app-bar-row px-g')}>
        {back && <BackButton to={typeof back === 'string' ? back : undefined} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs font-semibold text-2">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-5 grid size-20 place-items-center rounded-[28px] surface-2 text-2">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {hint && <p className="mt-1 max-w-xs text-sm text-2">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function QtyStepper({ value, onChange, min = 0, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-9' : 'size-12'
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl surface-2 p-1" dir="ltr">
      <button aria-label="minus" className={cn(s, 'grid place-items-center rounded-xl surface shadow-sm active:scale-90 transition')} onClick={() => { haptic(); onChange(Math.max(min, value - 1)) }}>
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        className={cn('w-12 bg-transparent text-center font-extrabold outline-none', size === 'sm' && 'w-9 text-sm')}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
          onChange(Math.max(min, Math.min(100000, n)))
        }}
      />
      <button aria-label="plus" className={cn(s, 'grid place-items-center rounded-xl bg-ink text-white dark:bg-white dark:text-ink active:scale-90 transition')} onClick={() => { haptic(); onChange(value + 1) }}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

const statusStyle: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  preparing: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  on_the_way: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = usePrefs()
  return (
    <span className={cn('chip', statusStyle[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(`status_${status}` as const)}
    </span>
  )
}

export function BrandLogo({ category, className }: { category: Pick<Category, 'logo' | 'name_en'>; className?: string }) {
  return (
    <div className={cn('logo-plate relative grid place-items-center overflow-hidden', className)}>
      {category.logo
        ? <img src={assetUrl(category.logo)} alt={category.name_en} className="absolute inset-0 size-full object-contain" loading="lazy" draggable={false} />
        : <span className="font-black text-ink">{category.name_en}</span>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-2xl', className)} />
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  // Android back closes the sheet; lock page scroll while open
  useEffect(() => {
    if (!open) return
    const off = pushBackHandler(onClose)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { off(); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="fade-in absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-in relative max-h-[calc(100dvh-var(--sat)-24px)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] surface pb-[var(--sab)] shadow-2xl sm:max-h-[90dvh] sm:rounded-[28px] sm:pb-0">
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 surface sm:hidden"><div className="h-1 w-8 rounded-full bg-[var(--text-2)] opacity-40" /></div>
        {children}
      </div>
    </div>
  )
}

/** Android-style pull-to-refresh for the page (window scroll). */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown> | void; children: ReactNode }) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef<number | null>(null)
  const pullRef = useRef(0)
  const MAX = 90, TRIGGER = 64
  useEffect(() => {
    const down = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null }
    const move = (e: TouchEvent) => {
      if (start.current == null) return
      const d = e.touches[0].clientY - start.current
      if (d <= 0) { pullRef.current = 0; setPull(0); return }
      const v = Math.min(MAX, d * 0.5)
      if (v >= TRIGGER && pullRef.current < TRIGGER) haptic()
      pullRef.current = v; setPull(v)
    }
    const up = async () => {
      if (start.current == null) return
      start.current = null
      if (pullRef.current >= TRIGGER) {
        setBusy(true); setPull(56)
        try { await onRefresh() } finally { setBusy(false); setPull(0); pullRef.current = 0 }
      } else { setPull(0); pullRef.current = 0 }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up) }
  }, [onRefresh, busy])
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center with-rail" style={{ top: `calc(var(--sat) + ${pull - 44}px)`, opacity: Math.min(1, pull / TRIGGER), transition: start.current == null ? 'top .25s, opacity .25s' : 'none' }}>
        <span className="grid size-10 place-items-center rounded-full surface shadow-lg ring-1 ring-[var(--border)]">
          <RefreshCw className="size-5 text-brand" style={{ transform: `rotate(${pull * 4}deg)`, animation: busy ? 'spin .8s linear infinite' : undefined }} />
        </span>
      </div>
      {children}
    </>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = usePrefs()
  return (
    <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="font-bold">{t('error')}</p>
      <p className="mt-1 break-words opacity-80">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-3 font-bold underline">{t('retry')}</button>}
    </div>
  )
}

/** Lazy image that loads the light thumbnail first and falls back to the full picture. */
export function Thumb({ src, alt = '', className, full }: { src: string; alt?: string; className?: string; full?: boolean }) {
  const [cur, setCur] = useState(full ? src : thumbOf(src))
  useEffect(() => { setCur(full ? src : thumbOf(src)) }, [src, full])
  return (
    <img src={cur} alt={alt} className={className} loading="lazy" decoding="async" draggable={false}
      onError={() => { if (cur !== src) setCur(src) }} />
  )
}
