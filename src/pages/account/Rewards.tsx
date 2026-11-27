import { useCallback, useEffect, useState } from 'react'
import { Gift, Sparkles } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader, Skeleton } from '../../components/ui'
import { dateTime } from '../../lib/format'
import type { Reward } from '../../lib/types'

/** Account → Rewards: gifts / prizes Sanad Company gave this member. */
export default function Rewards() {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const [list, setList] = useState<Reward[] | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data } = await supabase.from('rewards').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    setList((data as Reward[]) ?? [])
  }, [session])
  useEffect(() => {
    load()
    if (!session) return
    const ch = supabase.channel('my-rewards').on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter: `user_id=eq.${session.user.id}` }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, session])

  const isNew = (r: Reward) => Date.now() - new Date(r.created_at).getTime() < 7 * 864e5

  return (
    <div>
      <PageHeader back="/account" title={t('rewards')} />
      <div className="page-narrow px-g space-y-3 pb-6">
        {!list && [0, 1].map(i => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        {list?.length === 0 && (
          <div className="card flex flex-col items-center gap-3 px-8 py-14 text-center">
            <span className="grid size-20 place-items-center rounded-[28px] bg-gradient-to-br from-amber-300 to-rose-400 text-white shadow-lg"><Gift className="size-10" /></span>
            <p className="max-w-xs text-sm leading-7 text-2">{t('rewardsEmpty')}</p>
          </div>
        )}
        {list?.map((r, i) => (
          <article key={r.id} className="rise card overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
            {r.image_url
              ? <img src={r.image_url} alt="" className="aspect-[2/1] w-full bg-[var(--surface-2)] object-cover" loading="lazy" />
              : <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-white"><Gift className="size-12 drop-shadow" /></div>}
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-extrabold leading-snug">{r.title}</h2>
                {isNew(r) && <span className="chip shrink-0 bg-rose-500 text-white"><Sparkles className="size-3.5" />{t('newReward')}</span>}
              </div>
              {r.body && <p className="whitespace-pre-line text-sm leading-7 text-2">{r.body}</p>}
              <p className="text-[11px] font-semibold text-2">{dateTime(r.created_at, lang)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
