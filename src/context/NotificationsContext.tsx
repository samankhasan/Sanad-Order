import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { usePrefs } from './PrefsContext'
import { refreshPush } from '../lib/push'
import type { AppNotification } from '../lib/types'

let audio: HTMLAudioElement | null = null
function playNotifySound() {
  try {
    audio ??= new Audio(`${import.meta.env.BASE_URL}sounds/notify.mp3`)
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch { /* ignore */ }
}

interface Ctx {
  items: AppNotification[] | null
  unread: number
  markAllSeen: () => Promise<void>
  reload: () => Promise<void>
}
const C = createContext<Ctx | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session, profile, refreshProfile } = useAuth()
  const { lang } = usePrefs()
  const nav = useNavigate()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [banner, setBanner] = useState<AppNotification | null>(null)
  const uid = session?.user.id

  const reload = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase.from('notifications').select('*')
      .or(`target_user.is.null,target_user.eq.${uid}`)
      .order('created_at', { ascending: false }).limit(100)
    setItems((data as AppNotification[]) ?? [])
  }, [uid])

  useEffect(() => {
    if (!uid) return
    reload()
    refreshPush(p => nav(p))
    const ch = supabase.channel('my-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const n = payload.new as AppNotification
        if (n.target_user && n.target_user !== uid) return
        setItems(list => [n, ...(list ?? []).filter(x => x.id !== n.id)])
        setBanner(n)
        playNotifySound()
        setTimeout(() => setBanner(b => (b?.id === n.id ? null : b)), 5000)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid, reload, nav])

  // keep the user's language on the server so status notifications arrive in it
  useEffect(() => {
    if (uid && profile && profile.lang !== lang) supabase.from('profiles').update({ lang }).eq('id', uid).then(() => {})
  }, [uid, profile, lang])

  const seenAt = profile?.notifications_seen_at ? new Date(profile.notifications_seen_at).getTime() : Date.now()
  const unread = (items ?? []).filter(n => new Date(n.created_at).getTime() > seenAt).length

  const markAllSeen = useCallback(async () => {
    if (!uid) return
    await supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', uid)
    await refreshProfile()
  }, [uid, refreshProfile])

  return (
    <C.Provider value={{ items, unread, markAllSeen, reload }}>
      {children}
      {banner && (
        <button
          onClick={() => { setBanner(null); nav(banner.link || '/notifications') }}
          className="toast-in fixed inset-x-3 top-[calc(var(--sat)+10px)] z-[90] mx-auto flex max-w-md items-start gap-3 rounded-3xl border border-theme surface p-4 text-start shadow-2xl"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink text-white dark:bg-white dark:text-ink"><Bell className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-extrabold">{banner.title}</span>
            <span className="line-clamp-2 text-sm text-2">{banner.body}</span>
          </span>
        </button>
      )}
    </C.Provider>
  )
}

export function useNotifications() {
  const c = useContext(C)
  if (!c) throw new Error('useNotifications outside provider')
  return c
}
