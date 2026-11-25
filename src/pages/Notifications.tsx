import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useNotifications } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import { EmptyState, PageHeader, Skeleton, Spinner } from '../components/ui'
import { enablePush, pushState, type PushState } from '../lib/push'
import { dateTime } from '../lib/format'

export default function Notifications() {
  const { t, lang } = usePrefs()
  const { items, unread, markAllSeen } = useNotifications()
  const toast = useToast()
  const nav = useNavigate()
  const [state, setState] = useState<PushState>(pushState())
  const [busy, setBusy] = useState(false)
  const [seenBefore] = useState(() => Date.now())

  useEffect(() => { if (unread > 0) markAllSeen() }, [unread, markAllSeen])

  async function turnOn() {
    setBusy(true)
    try { setState(await enablePush(p => nav(p))) } catch (e) { toast((e as Error).message, 'error') }
    setBusy(false)
  }

  return (
    <div>
      <PageHeader back title={t('notifications')} />
      <div className="page-narrow px-g space-y-3">
        {state === 'default' && (
          <div className="rise card flex items-center gap-3 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-s-blue text-white"><BellRing className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{t('enablePush')}</p>
              <p className="text-xs text-2">{t('enablePushHint')}</p>
            </div>
            <button disabled={busy} onClick={turnOn} className="btn btn-primary shrink-0 px-4 py-2.5 text-sm">{busy ? <Spinner className="size-4" /> : 'OK'}</button>
          </div>
        )}
        {state === 'denied' && (
          <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><BellOff className="size-4 shrink-0" />{t('pushDenied')}</p>
        )}

        {!items && [0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}
        {items?.length === 0 && <EmptyState icon={<Bell className="size-9" />} title={t('noNotifications')} hint={t('noNotificationsHint')} />}
        {items?.map((n, i) => {
          const fresh = new Date(n.created_at).getTime() > seenBefore - 1000 * 60 * 60 * 24
          return (
            <button key={n.id} onClick={() => n.link && nav(n.link)} className="rise card block w-full overflow-hidden text-start" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              {n.image_url && <img src={n.image_url} alt="" className="max-h-56 w-full bg-white object-cover" loading="lazy" />}
              <div className="flex gap-3 p-4">
                <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl surface-2">
                  <Bell className="size-5" />
                  {fresh && <span className="absolute -top-0.5 -end-0.5 size-3 rounded-full bg-s-red ring-2 ring-[var(--surface)]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{n.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-2">{n.body}</p>
                  <p className="mt-2 text-[11px] font-semibold text-2">{dateTime(n.created_at, lang)}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
