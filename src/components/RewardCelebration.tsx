import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Gift, Sparkles } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { pushBackHandler } from '../lib/native'
import type { Reward } from '../lib/types'

const CONFETTI = ['#f59e0b', '#ef4444', '#0284d6', '#4fa62f', '#a855f7', '#f36f21']

/** When a member has a reward they haven't opened yet (given while they were away, or right now while the app is open),
 *  a celebration dialog appears in the middle of the screen. Opening or closing it marks the reward(s) as seen. */
export default function RewardCelebration() {
  const { t } = usePrefs()
  const { session, isStaff } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [unseen, setUnseen] = useState<Reward[]>([])
  const uid = session?.user.id

  const load = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase.from('rewards').select('*').eq('user_id', uid).is('seen_at', null).order('created_at', { ascending: false }).limit(10)
    setUnseen((data as Reward[]) ?? [])
  }, [uid])

  useEffect(() => {
    if (!uid || isStaff) return
    load()
    const ch = supabase.channel('reward-celebration')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rewards', filter: `user_id=eq.${uid}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid, isStaff, load])

  const markSeen = useCallback(async (ids: string[]) => {
    setUnseen([])
    if (ids.length) await supabase.from('rewards').update({ seen_at: new Date().toISOString() }).in('id', ids)
  }, [])

  // the Rewards page shows everything anyway → opening it counts as seen
  useEffect(() => { if (pathname === '/account/rewards' && unseen.length) markSeen(unseen.map(r => r.id)) }, [pathname, unseen, markSeen])

  const open = unseen.length > 0 && pathname !== '/account/rewards'
  const closeRef = useRef(() => {})
  useEffect(() => {
    if (!open) return
    const off = pushBackHandler(() => closeRef.current())
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { off(); document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  const r = unseen[0]
  const close = () => markSeen(unseen.map(x => x.id))
  closeRef.current = close
  const view = () => { close(); nav('/account/rewards') }

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="reward-title">
      <div className="fade-in absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={close} />
      <section className="pop-in relative w-full max-w-sm overflow-hidden rounded-[28px] surface text-center shadow-2xl">
        {/* header: picture, or a festive gradient with the gift */}
        <div className="relative overflow-hidden">
          {r.image_url
            ? <img src={r.image_url} alt="" className="aspect-[2/1] w-full object-cover" />
            : <div className="aspect-[2/1] w-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500" />}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="confetti absolute top-[-10%] block h-2.5 w-1.5 rounded-sm"
                style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 6) * 0.18}s`, animationDuration: `${2.2 + (i % 4) * 0.35}s` }} />
            ))}
          </div>
          {!r.image_url && <span className="gift-bounce absolute inset-0 grid place-items-center text-white"><Gift className="size-16 drop-shadow-lg" /></span>}
        </div>
        <div className="px-6 pb-6 pt-5">
          <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <Sparkles className="size-3.5" />{t('rewardForYou')}
          </p>
          <h2 id="reward-title" className="mt-3 text-xl font-black leading-snug">{r.title}</h2>
          {r.body && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-7 text-2">{r.body}</p>}
          <p className="mt-2 text-xs font-semibold text-2">{t('rewardFromSanad')}</p>
          {unseen.length > 1 && <p className="mt-2 inline-flex gap-1 rounded-full surface-2 px-3 py-1 text-xs font-bold"><bdi dir="ltr">+{unseen.length - 1}</bdi><span>{t('moreRewards')}</span></p>}
          <div className="mt-5 space-y-2">
            <button onClick={view} className="btn min-h-13 w-full bg-gradient-to-r from-amber-500 to-rose-500 text-base text-white shadow-lg shadow-rose-500/25">
              <Gift className="size-5" />{t('viewMyRewards')}
            </button>
            <button onClick={close} className="btn btn-ghost min-h-12 w-full">{t('close')}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
