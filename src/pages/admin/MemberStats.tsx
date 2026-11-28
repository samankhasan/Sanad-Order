import { useMemo, useState } from 'react'
import { CalendarPlus, TrendingUp, Users } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { cn, dateTime } from '../../lib/format'
import type { Profile } from '../../lib/types'

type Period = 'day' | 'week' | 'month' | 'year'
const DAYS: Record<Period, number> = { day: 0, week: 6, month: 29, year: 364 }

/** start of the local day `back` days ago */
function since(back: number) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); return d.getTime() }

/** New members today / 7 days / 30 days / year, with the newest of the chosen period. */
export default function MemberStats({ rows, onOpen }: { rows: Profile[]; onOpen?: (p: Profile) => void }) {
  const { t, lang } = usePrefs()
  const [period, setPeriod] = useState<Period>('day')

  const counts = useMemo(() => {
    const c = {} as Record<Period, number>
    for (const k of Object.keys(DAYS) as Period[]) { const from = since(DAYS[k]); c[k] = rows.filter(r => new Date(r.created_at).getTime() >= from).length }
    return c
  }, [rows])
  const newest = useMemo(() => {
    const from = since(DAYS[period])
    return rows.filter(r => new Date(r.created_at).getTime() >= from).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12)
  }, [rows, period])

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <h2 className="flex items-center gap-2 font-extrabold"><TrendingUp className="size-5" />{t('newMembers')}</h2>
        <span className="chip surface-2"><Users className="size-3.5" />{t('totalMembers')} <b dir="ltr">{rows.length.toLocaleString('en-US')}</b></span>
      </div>
      {/* the four periods are both the numbers and the selector */}
      <div className="grid grid-cols-4 gap-2 px-4">
        {(Object.keys(DAYS) as Period[]).map(k => (
          <button key={k} onClick={() => setPeriod(k)} aria-pressed={period === k}
            className={cn('rounded-2xl p-3 text-center transition', period === k ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow' : 'surface-2')}>
            <p className="text-2xl font-black tabular-nums leading-none" dir="ltr">{counts[k]}</p>
            <p className={cn('mt-1.5 text-[11px] font-bold', period === k ? 'opacity-80' : 'text-2')}>{t(`period_${k}` as const)}</p>
          </button>
        ))}
      </div>
      <div className="p-4 pt-3">
        <p className="label !mb-2 flex items-center gap-1.5"><CalendarPlus className="size-3.5" />{t('newestMembers')} · {t(`period_${period}` as const)}</p>
        {newest.length === 0
          ? <p className="rounded-2xl surface-2 p-4 text-center text-sm text-2">{t('noNewMembers')}</p>
          : <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {newest.map(p => (
                <li key={p.id} className="shrink-0">
                  <button onClick={() => onOpen?.(p)} className="flex w-28 flex-col items-center gap-1.5 rounded-2xl surface-2 p-3 text-center transition active:scale-[.97]">
                    <span className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-[var(--surface)] text-lg font-black">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-full object-cover" /> : (p.full_name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="w-full truncate text-xs font-bold">{p.full_name || '—'}</span>
                    <span className="w-full truncate text-[10px] text-2">{dateTime(p.created_at, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>}
      </div>
    </section>
  )
}
