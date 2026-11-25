import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, BellRing, ChevronLeft, ChevronRight, ExternalLink, Megaphone, PackageCheck } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import { EmptyState, PageHeader, Sheet, Skeleton, Spinner, Thumb } from '../components/ui'
import { enablePush, lastPushError, pushState, pushStateAsync, type PushState } from '../lib/push'
import { cn, dateTime } from '../lib/format'
import type { AppNotification } from '../lib/types'

type Group = 'today' | 'yesterday' | 'earlier'

export default function Notifications() {
  const { t, lang, dir } = usePrefs()
  const { profile } = useAuth()
  const { items, unread, markAllSeen } = useNotifications()
  const toast = useToast()
  const nav = useNavigate()
  const [state, setState] = useState<PushState>(pushState())
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<AppNotification | null>(null)
  // remember what was unread when the page opened, then mark everything seen
  const [seenAt] = useState(() => (profile?.notifications_seen_at ? new Date(profile.notifications_seen_at).getTime() : 0))
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight

  useEffect(() => { if (unread > 0) markAllSeen() }, [unread, markAllSeen])
  useEffect(() => { pushStateAsync().then(setState).catch(() => {}) }, [])

  async function turnOn() {
    setBusy(true)
    try { setState(await enablePush(p => nav(p))) } catch (e) { toast((e as Error).message, 'error') }
    setBusy(false)
  }

  const groups = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const today = start.getTime(), yesterday = today - 864e5
    const g: Record<Group, AppNotification[]> = { today: [], yesterday: [], earlier: [] }
    ;(items ?? []).forEach(n => {
      const ts = new Date(n.created_at).getTime()
      g[ts >= today ? 'today' : ts >= yesterday ? 'yesterday' : 'earlier'].push(n)
    })
    return g
  }, [items])

  function when(iso: string) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return t('justNow')
    if (m < 60) return `${m} ${t('minAgo')}`
    if (m < 24 * 60) return `${Math.floor(m / 60)} ${t('hoursAgo')}`
    return dateTime(iso, lang)
  }

  function tap(n: AppNotification) {
    if (n.image_url || n.body.length > 90) setOpen(n)
    else if (n.link) nav(n.link)
    else setOpen(n)
  }

  return (
    <div>
      <PageHeader back title={t('notifications')} />
      <div className="page-narrow px-g space-y-4">
        {state === 'default' && (
          <div className="rise flex items-center gap-3 rounded-[20px] bg-ink p-4 text-white shadow-lg dark:bg-[var(--surface-2)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10"><BellRing className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{t('enablePush')}</p>
              <p className="line-clamp-2 text-xs text-white/70">{t('enablePushHint')}</p>
            </div>
            <button disabled={busy} onClick={turnOn} className="btn min-h-10 shrink-0 bg-white px-4 py-2 text-sm text-ink">{busy ? <Spinner className="size-4" /> : 'OK'}</button>
          </div>
        )}
        {state === 'granted' && lastPushError && (
          <p className="rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" dir="ltr">Push: {lastPushError}</p>
        )}
        {state === 'denied' && (
          <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><BellOff className="size-4 shrink-0" />{t('pushDenied')}</p>
        )}

        {!items && <div className="card divide-y divide-[var(--border)] overflow-hidden">{[0, 1, 2, 3].map(i => <div key={i} className="flex gap-3 p-4"><Skeleton className="size-14 rounded-2xl" /><div className="flex-1 space-y-2 py-1"><Skeleton className="h-3.5 w-2/3 rounded" /><Skeleton className="h-3 w-full rounded" /></div></div>)}</div>}
        {items?.length === 0 && <EmptyState icon={<Bell className="size-9" />} title={t('noNotifications')} hint={t('noNotificationsHint')} />}

        {(['today', 'yesterday', 'earlier'] as Group[]).map(g => groups[g].length > 0 && (
          <section key={g}>
            <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-2">{t(g)}</h2>
            <ul className="card divide-y divide-[var(--border)] overflow-hidden">
              {groups[g].map(n => {
                const isNew = new Date(n.created_at).getTime() > seenAt
                const personal = !!n.target_user
                return (
                  <li key={n.id}>
                    <button onClick={() => tap(n)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-start transition active:bg-[var(--surface-2)]', isNew && 'bg-[color-mix(in_srgb,var(--color-brand)_6%,transparent)]')}>
                      {n.image_url ? (
                        <Thumb src={n.image_url} className="size-14 shrink-0 rounded-2xl border border-theme bg-white object-cover" />
                      ) : (
                        <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', personal ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300')}>
                          {personal ? <PackageCheck className="size-6" /> : <Megaphone className="size-6" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="line-clamp-1 flex-1 text-[15px] font-extrabold">{n.title}</span>
                          {isNew && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-s-red" aria-label="new" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-2">{n.body}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-2 opacity-80">{when(n.created_at)}</span>
                      </span>
                      {(n.link || n.image_url) && <Chevron className="mt-4 size-4 shrink-0 text-2" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* detail sheet */}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div>
            {open.image_url && <img src={open.image_url} alt="" className="max-h-[45dvh] w-full bg-white object-contain" />}
            <div className="space-y-3 p-5">
              <p className="text-xs font-semibold text-2">{dateTime(open.created_at, lang)}</p>
              <h2 className="text-xl font-extrabold leading-snug">{open.title}</h2>
              <p className="whitespace-pre-line leading-relaxed text-2">{open.body}</p>
              {open.link && (
                <button onClick={() => { const l = open.link!; setOpen(null); nav(l) }} className="btn btn-primary min-h-12 w-full">
                  <ExternalLink className="size-5" />{t('openLink')}
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
