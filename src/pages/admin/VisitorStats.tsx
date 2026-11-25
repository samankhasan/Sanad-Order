import { useEffect, useState } from 'react'
import { Eye, UserRound, Users } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { supabase } from '../../lib/supabase'
import { Skeleton } from '../../components/ui'
import { cn } from '../../lib/format'

type Period = 'day' | 'week' | 'month' | 'year'
interface Stats {
  day: Counts; week: Counts; month: Counts; year: Counts
  series: { day: string; users: number; guests: number }[]
}
interface Counts { users: number; guests: number; visits: number }

const USERS = '#0284d6'
const GUESTS = '#f36f21'

export default function VisitorStats() {
  const { t, lang } = usePrefs()
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('day')
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    supabase.rpc('visit_stats').then(({ data, error }) => { if (error) setErr(error.message); else setStats(data as Stats) })
  }, [])

  if (err) return <p className="card p-4 text-sm text-rose-600">{err}</p>
  if (!stats) return <Skeleton className="h-72 rounded-3xl" />

  const c = stats[period]
  const series = stats.series
  const max = Math.max(1, ...series.map(s => s.users + s.guests))
  const W = 600, H = 140, gap = 4, bw = (W - gap * (series.length - 1)) / series.length
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ', { day: 'numeric', month: 'short', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions).format(new Date(d))
  const sel = hover != null ? series[hover] : null

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold"><Eye className="size-5" />{t('visitors')}</h2>
        <div className="flex gap-1 rounded-2xl surface-2 p-1">
          {(['day', 'week', 'month', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={cn('min-h-10 rounded-xl px-3 text-xs font-bold transition', period === p ? 'surface shadow' : 'text-2')}>{t(`period_${p}` as const)}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: UserRound, label: t('users'), v: c.users, color: USERS },
          { icon: Users, label: t('guests'), v: c.guests, color: GUESTS },
          { icon: Eye, label: t('visits'), v: c.visits, color: '#4fa62f' }
        ].map(x => (
          <div key={x.label} className="rounded-2xl surface-2 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-2"><span className="size-2 rounded-full" style={{ background: x.color }} />{x.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums" dir="ltr">{x.v.toLocaleString('en-US')}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex min-h-5 items-center justify-between text-xs font-semibold text-2">
          <span>{t('last30')}</span>
          {sel && <span dir="ltr"><b style={{ color: USERS }}>{sel.users}</b> · <b style={{ color: GUESTS }}>{sel.guests}</b> — {fmtDay(sel.day)}</span>}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" style={{ direction: 'ltr' }} onMouseLeave={() => setHover(null)} role="img" aria-label={t('last30')}>
          {series.map((s, i) => {
            const x = i * (bw + gap)
            const hu = (s.users / max) * (H - 4), hg = (s.guests / max) * (H - 4)
            const dim = hover != null && hover !== i
            return (
              <g key={s.day} opacity={dim ? 0.35 : 1} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={x} y={0} width={bw} height={H} fill="transparent" />
                <rect x={x} y={H - 2} width={bw} height={2} rx={1} fill="var(--surface-3)" />
                {hu > 0 && <rect x={x} y={H - hu} width={bw} height={hu} rx={Math.min(3, bw / 2)} fill={USERS} />}
                {hg > 0 && <rect x={x} y={H - hu - hg - (hu > 0 ? 2 : 0)} width={bw} height={hg} rx={Math.min(3, bw / 2)} fill={GUESTS} />}
              </g>
            )
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-2" dir="ltr">
          <span>{fmtDay(series[0].day)}</span><span>{fmtDay(series[series.length - 1].day)}</span>
        </div>
      </div>
    </section>
  )
}
