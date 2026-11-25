import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Minus, Plus } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { assetUrl, cn } from '../lib/format'
import type { Category, OrderStatus } from '../lib/types'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin', className)} />
}

export function BackButton({ to }: { to?: string }) {
  const nav = useNavigate()
  const { dir } = usePrefs()
  const Icon = dir === 'rtl' ? ArrowRight : ArrowLeft
  return (
    <button aria-label="back" onClick={() => (to ? nav(to) : nav(-1))} className="grid size-11 place-items-center rounded-2xl surface border border-theme active:scale-95 transition">
      <Icon className="size-5" />
    </button>
  )
}

export function PageHeader({ title, back, right, subtitle }: { title: ReactNode; back?: boolean | string; right?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 safe-top backdrop-blur-xl bg-[color-mix(in_srgb,var(--bg)_85%,transparent)]">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {back && <BackButton to={typeof back === 'string' ? back : undefined} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-2">{subtitle}</p>}
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
  const s = size === 'sm' ? 'size-8' : 'size-11'
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl surface-2 p-1" dir="ltr">
      <button aria-label="minus" className={cn(s, 'grid place-items-center rounded-xl surface shadow-sm active:scale-90 transition')} onClick={() => onChange(Math.max(min, value - 1))}>
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
      <button aria-label="plus" className={cn(s, 'grid place-items-center rounded-xl bg-ink text-white dark:bg-white dark:text-ink active:scale-90 transition')} onClick={() => onChange(value + 1)}>
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="fade-in absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-in relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] surface pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-[32px]">
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 surface sm:hidden"><div className="h-1.5 w-12 rounded-full bg-[var(--border)]" /></div>
        {children}
      </div>
    </div>
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
