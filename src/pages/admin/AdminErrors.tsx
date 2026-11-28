import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, CheckCircle2, ChevronDown, Globe, RotateCcw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/format'
import { ErrorBox, Skeleton } from '../../components/ui'

interface AppError {
  id: number
  message: string
  stack: string | null
  url: string | null
  app_version: string
  platform: string | null
  user_agent: string | null
  count: number
  first_seen: string
  last_seen: string
  resolved_at: string | null
  profiles: { full_name: string | null } | null
}
type Filter = 'open' | 'resolved' | 'all'

/** Admin → Errors: crashes and errors that happened on members' phones / browsers, grouped and counted. */
export default function AdminErrors() {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const [rows, setRows] = useState<AppError[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [openId, setOpenId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_errors').select('*, profiles(full_name)').order('last_seen', { ascending: false }).limit(300)
    if (error) setError(error.message); else setRows(data as AppError[])
  }, [])
  useEffect(() => { load() }, [load])

  async function setResolved(e: AppError, resolved: boolean) {
    const { error } = await supabase.from('app_errors').update({ resolved_at: resolved ? new Date().toISOString() : null }).eq('id', e.id)
    if (error) toast(error.message, 'error'); else { toast(resolved ? t('erMarkedFixed') : t('erReopened')); load() }
  }
  async function remove(e: AppError) {
    if (!confirm(t('erDeleteConfirm'))) return
    const { error } = await supabase.from('app_errors').delete().eq('id', e.id)
    if (error) toast(error.message, 'error'); else load()
  }

  const counts = useMemo(() => ({
    open: rows?.filter(r => !r.resolved_at).length ?? 0,
    resolved: rows?.filter(r => r.resolved_at).length ?? 0,
    all: rows?.length ?? 0,
    day: rows?.filter(r => !r.resolved_at && Date.now() - new Date(r.last_seen).getTime() < 864e5).length ?? 0
  }), [rows])
  const list = (rows ?? []).filter(r => filter === 'all' || (filter === 'open' ? !r.resolved_at : !!r.resolved_at))

  const ago = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return t('justNow')
    if (m < 60) return `${m} ${t('minAgo')}`
    if (m < 1440) return `${Math.floor(m / 60)} ${t('hoursAgo')}`
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-IQ', { dateStyle: 'medium', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* health summary */}
      {rows && (
        <div className={cn('flex items-center gap-3 rounded-3xl p-4', counts.open ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200')}>
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-white', counts.open ? 'bg-amber-500' : 'bg-emerald-500')}>{counts.open ? <Bug className="size-6" /> : <ShieldCheck className="size-6" />}</span>
          <div className="min-w-0">
            <p className="font-extrabold">{counts.open ? t('erOpenTitle').replace('{n}', String(counts.open)) : t('erAllGood')}</p>
            <p className="text-xs opacity-80">{counts.open ? t('erOpenHint').replace('{n}', String(counts.day)) : t('erAllGoodHint')}</p>
          </div>
        </div>
      )}

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {([['open', t('erOpen')], ['resolved', t('erFixed')], ['all', t('acAll')]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn('filter-chip', filter === k && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>
            {label} <span className="opacity-70" dir="ltr">{counts[k]}</span>
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>}
      {rows && list.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-8 py-14 text-center text-2">
          <CheckCircle2 className="size-10 text-emerald-500" /><p className="text-sm font-semibold">{t('erNone')}</p>
        </div>
      )}

      <ul className="space-y-3">
        {list.map(e => {
          const expanded = openId === e.id
          return (
            <li key={e.id} className={cn('card overflow-hidden', e.resolved_at && 'opacity-70')}>
              <button onClick={() => setOpenId(expanded ? null : e.id)} className="flex w-full items-start gap-3 p-4 text-start">
                <span className={cn('mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl', e.resolved_at ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300')}>
                  {e.resolved_at ? <CheckCircle2 className="size-5" /> : <Bug className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words font-mono text-[13px] font-bold leading-5" dir="ltr">{e.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-2">
                    <span className="inline-flex items-center gap-1">{e.platform === 'web' ? <Globe className="size-3.5" /> : <Smartphone className="size-3.5" />}{e.platform ?? '—'}</span>
                    <span dir="ltr">v{e.app_version || '?'}</span>
                    <span>{ago(e.last_seen)}</span>
                    {e.profiles?.full_name && <span>{e.profiles.full_name}</span>}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white tabular-nums" title={t('erTimes')} dir="ltr">×{e.count}</span>
                <ChevronDown className={cn('mt-2 size-4 shrink-0 text-2 transition', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <div className="space-y-3 border-t border-theme p-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="font-bold text-2">{t('erFirstSeen')}</dt><dd dir="ltr" className="text-start">{new Date(e.first_seen).toLocaleString('en-GB')}</dd>
                    <dt className="font-bold text-2">{t('erLastSeen')}</dt><dd dir="ltr" className="text-start">{new Date(e.last_seen).toLocaleString('en-GB')}</dd>
                    <dt className="font-bold text-2">{t('erScreen')}</dt><dd dir="ltr" className="break-all text-start">{e.url || '—'}</dd>
                    <dt className="font-bold text-2">{t('erDevice')}</dt><dd dir="ltr" className="break-all text-start text-2">{e.user_agent || '—'}</dd>
                  </dl>
                  {e.stack && <pre className="max-h-64 overflow-auto rounded-2xl bg-ink p-3 text-[11px] leading-5 text-white/90" dir="ltr">{e.stack}</pre>}
                  <div className="flex gap-2">
                    {e.resolved_at
                      ? <button onClick={() => setResolved(e, false)} className="btn btn-ghost min-h-11 flex-1 text-sm"><RotateCcw className="size-4" />{t('reopen')}</button>
                      : <button onClick={() => setResolved(e, true)} className="btn min-h-11 flex-1 bg-emerald-600 text-sm text-white"><CheckCircle2 className="size-4" />{t('erMarkFixed')}</button>}
                    <button onClick={() => remove(e)} aria-label={t('delete')} className="grid size-11 place-items-center rounded-xl text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
