import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Clock, Gift, Target, Trophy, Users } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { PageHeader, Skeleton, Spinner } from '../../components/ui'
import { cn, dateTime, money } from '../../lib/format'
import type { MyChallenge } from '../../lib/types'

type Tab = 'active' | 'completed' | 'expired'

export function goalText(c: Pick<MyChallenge, 'goal_type' | 'goal_value'>, t: (k: never) => string, lang: string) {
  const n = c.goal_type === 'spend_total' ? money(Number(c.goal_value), lang as never) : Number(c.goal_value).toLocaleString('en-US')
  return t(`ch_goal_${c.goal_type}` as never).replace('{n}', n)
}

function timeLeft(iso: string, t: (k: never) => string) {
  const ms = new Date(iso).getTime() - Date.now()
  const d = Math.floor(ms / 864e5)
  return d >= 1 ? `${d} ${t('ch_days' as never)}` : `${Math.max(1, Math.ceil(ms / 36e5))} ${t('ch_hours' as never)}`
}

function ActiveCard({ c, onChanged }: { c: MyChallenge; onChanged: () => void }) {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const upcoming = new Date(c.starts_at).getTime() > Date.now()
  const pct = c.goal_type !== 'custom' && c.goal_value ? Math.min(100, (Number(c.progress) / Number(c.goal_value)) * 100) : 0
  const tt = t as (k: never) => string

  async function join() {
    if (!session) return
    setBusy(true)
    const { error } = await supabase.from('challenge_participants').insert({ challenge_id: c.id, user_id: session.user.id })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(t('ch_joinedToast')); onChanged()
  }
  async function leave() {
    if (!session || !confirm(`${t('ch_leave')}?`)) return
    setBusy(true)
    await supabase.from('challenge_participants').delete().eq('challenge_id', c.id).eq('user_id', session.user.id)
    setBusy(false); onChanged()
  }

  return (
    <article className="rise card overflow-hidden">
      <div className="relative">
        {c.image_url
          ? <img src={c.image_url} alt="" className="aspect-[2/1] w-full bg-[var(--surface-2)] object-cover" loading="lazy" />
          : <div className="flex aspect-[5/2] items-center justify-center bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white"><Trophy className="size-14 drop-shadow" /></div>}
        <span className="absolute start-3 top-3 chip bg-black/60 text-white backdrop-blur">
          <Clock className="size-3.5" />{upcoming ? `${t('ch_startsIn')} ${timeLeft(c.starts_at, tt)}` : `${t('ch_endsIn')} ${timeLeft(c.ends_at, tt)}`}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <h2 className="text-lg font-extrabold leading-snug">{c.title}</h2>
        {c.description && <p className="whitespace-pre-line text-sm leading-7 text-2">{c.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip surface-2"><Target className="size-3.5" />{goalText(c, tt, lang)}</span>
          {c.reward_text && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><Gift className="size-3.5" />{t('ch_reward')}: {c.reward_text}</span>}
          <span className="chip surface-2"><Users className="size-3.5" /><bdi dir="ltr">{c.participants}</bdi> {t('ch_participants')}</span>
        </div>
        {c.joined && c.goal_type !== 'custom' && (
          <div className="rounded-2xl surface-2 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span>{t('ch_progress')}</span>
              <span dir="ltr">{c.goal_type === 'spend_total' ? money(Number(c.progress), lang) : Number(c.progress)} / {c.goal_type === 'spend_total' ? money(Number(c.goal_value), lang) : Number(c.goal_value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }} /></div>
          </div>
        )}
        {c.joined
          ? <div className="flex items-center gap-2">
              <span className="chip flex-1 justify-center bg-emerald-100 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-4" />{t('ch_joined')}</span>
              <button onClick={leave} disabled={busy} className="btn btn-ghost min-h-11 px-4 text-sm">{t('ch_leave')}</button>
            </div>
          : <button onClick={join} disabled={busy || upcoming} className="btn btn-primary min-h-12 w-full">{busy ? <Spinner /> : <Trophy className="size-5" />}{upcoming ? t('ch_upcoming') : t('ch_join')}</button>}
      </div>
    </article>
  )
}

/** Account → Challenges: Active (join + progress), Completed, Expired (title + end date only). */
export default function Challenges() {
  const { t, lang } = usePrefs()
  const [list, setList] = useState<MyChallenge[] | null>(null)
  const [tab, setTab] = useState<Tab>('active')

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_challenges')
    setList((data as MyChallenge[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const now = Date.now()
    const all = list ?? []
    return {
      completed: all.filter(c => c.completed),
      active: all.filter(c => !c.completed && new Date(c.ends_at).getTime() > now).sort((a, b) => a.ends_at.localeCompare(b.ends_at)),
      expired: all.filter(c => !c.completed && new Date(c.ends_at).getTime() <= now)
    }
  }, [list])
  const tt = t as (k: never) => string

  return (
    <div>
      <PageHeader back="/account" title={t('challenges')} />
      <div className="page-narrow px-g space-y-4 pb-6">
        <div className="grid grid-cols-3 gap-1 rounded-2xl surface-2 p-1">
          {(['active', 'completed', 'expired'] as Tab[]).map(k => (
            <button key={k} onClick={() => setTab(k)} className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition', tab === k ? 'surface shadow' : 'text-2')}>
              {t(`ch_${k}` as const)}
              {!!groups[k].length && <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black', tab === k ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'bg-[var(--surface-3)]')}>{groups[k].length}</span>}
            </button>
          ))}
        </div>

        {!list && <Skeleton className="h-72 rounded-3xl" />}

        {list && tab === 'active' && (groups.active.length
          ? groups.active.map(c => <ActiveCard key={c.id} c={c} onChanged={load} />)
          : <Empty icon={<Trophy className="size-10" />} text={t('ch_emptyActive')} />)}

        {list && tab === 'completed' && (groups.completed.length
          ? groups.completed.map(c => (
              <article key={c.id} className="rise card flex items-center gap-3 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md"><Trophy className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{c.title}</p>
                  <p className="text-xs text-2">{goalText(c, tt, lang)}{c.reward_text && ` · ${t('ch_reward')}: ${c.reward_text}`}</p>
                </div>
                <CheckCircle2 className="size-6 shrink-0 text-emerald-500" />
              </article>
            ))
          : <Empty icon={<CheckCircle2 className="size-10" />} text={t('ch_emptyCompleted')} />)}

        {/* expired: only the title and when it ended, as plain text */}
        {list && tab === 'expired' && (groups.expired.length
          ? <section className="card divide-y divide-[var(--border)] overflow-hidden">
              {groups.expired.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                  <CalendarClock className="size-5 shrink-0 text-2" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.title}</p>
                    <p className="text-xs text-2">{t('ch_expiredOn')} {dateTime(c.ends_at, lang)}</p>
                  </div>
                </div>
              ))}
            </section>
          : <Empty icon={<CalendarClock className="size-10" />} text={t('ch_emptyExpired')} />)}
      </div>
    </div>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-8 py-14 text-center text-2">
      {icon}
      <p className="max-w-xs text-sm leading-7">{text}</p>
    </div>
  )
}
