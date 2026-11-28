import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Briefcase, Building2, MapPin, ChevronLeft, ChevronRight, Download, FileText, Gift, Info, LifeBuoy, Lock, LogOut, Palette, ReceiptText, Share2, ShieldCheck, BadgeCheck, Trophy, UserRound } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import { supabase } from '../../lib/supabase'
import { removeMyToken } from '../../lib/push'
import { displayIdentity } from '../../lib/identity'
import { PageHeader, Sheet } from '../../components/ui'
import { cn } from '../../lib/format'
import ShareApp from './ShareApp'

/** One row of the account menu: icon · label · optional value / badge · chevron */
export function MenuRow({ to, onClick, icon, label, value, badge, tone }: {
  to?: string; onClick?: () => void; icon: ReactNode; label: string; value?: ReactNode; badge?: number; tone?: 'danger'
}) {
  const { dir } = usePrefs()
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const inner = (
    <>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone === 'danger' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'surface-2')}>{icon}</span>
      <span className={cn('min-w-0 flex-1 truncate text-[15px] font-bold', tone === 'danger' && 'text-rose-600 dark:text-rose-400')}>{label}</span>
      {value != null && <span className="shrink-0 truncate text-sm font-semibold text-2">{value}</span>}
      {!!badge && <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-s-red px-1.5 text-[11px] font-black text-white">{badge > 99 ? '99+' : badge}</span>}
      {tone !== 'danger' && <Chevron className="size-5 shrink-0 text-2" />}
    </>
  )
  const cls = 'flex min-h-[64px] w-full items-center gap-3 px-4 text-start transition active:bg-[var(--surface-2)]'
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

function Group({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div>
      {title && <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-2">{title}</h2>}
      <section className="card divide-y divide-[var(--border)] overflow-hidden">{children}</section>
    </div>
  )
}

/** "Account": the member's hub — personal info, orders, rewards, challenges, sharing, help, settings. */
export default function Account() {
  const { t, lang } = usePrefs()
  const { profile, session, signOut, isAdmin, isOperator } = useAuth()
  const { unread } = useNotifications()
  const [counts, setCounts] = useState({ orders: 0, rewards: 0, newRewards: 0, challenges: 0 })
  const [sharing, setSharing] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const uid = session.user.id
    const week = new Date(Date.now() - 7 * 864e5).toISOString()
    const [o, r, rn, c] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', week),
      supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('is_active', true).lte('starts_at', new Date().toISOString()).gte('ends_at', new Date().toISOString())
    ])
    setCounts({ orders: o.count ?? 0, rewards: r.count ?? 0, newRewards: rn.count ?? 0, challenges: c.count ?? 0 })
  }, [session])
  useEffect(() => { load() }, [load])

  const initials = (profile?.full_name || session?.user.email || '?').slice(0, 1).toUpperCase()
  const num = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'en-US')

  return (
    <div>
      <PageHeader title={t('profile')} />
      <div className="page-narrow px-g space-y-4 pb-6">
        {/* member card */}
        <Link to="/account/info" className="card relative flex items-center gap-4 overflow-hidden p-5 transition active:scale-[.99]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 sanad-stripe" />
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-ink text-2xl font-black text-white dark:bg-white dark:text-ink">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{profile?.full_name || '—'}</p>
            <p className="truncate text-sm text-2" dir="ltr">{profile?.username ? `@${profile.username}` : displayIdentity(session?.user.email, profile?.phone)}</p>
            {isAdmin && <span className="chip mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck className="size-3.5" />{t('role_admin')}</span>}
            {isOperator && <span className="chip mt-1 bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"><BadgeCheck className="size-3.5" />{t('role_operator')}</span>}
          </div>
        </Link>

        <Group>
          <MenuRow to="/account/info" icon={<UserRound className="size-5" />} label={t('personalInfo')} />
          <MenuRow to="/account/addresses" icon={<MapPin className="size-5" />} label={t('myAddresses')} />
          <MenuRow to="/orders" icon={<ReceiptText className="size-5" />} label={t('yourOrders')} value={counts.orders ? num(counts.orders) : undefined} />
          <MenuRow to="/account/rewards" icon={<Gift className="size-5" />} label={t('rewards')} value={counts.rewards ? num(counts.rewards) : undefined} badge={counts.newRewards} />
          <MenuRow to="/account/challenges" icon={<Trophy className="size-5" />} label={t('challenges')} value={counts.challenges ? `${num(counts.challenges)} ${t('ch_active')}` : undefined} />
          <MenuRow to="/notifications" icon={<Bell className="size-5" />} label={t('notifications')} badge={unread} />
        </Group>

        <Group>
          <MenuRow onClick={() => setSharing(true)} icon={<Share2 className="size-5" />} label={t('shareApp')} />
          <MenuRow to="/account/install" icon={<Download className="size-5" />} label={t('installApp')} />
          <MenuRow to="/account/settings" icon={<Palette className="size-5" />} label={t('settings')} />
        </Group>

        <Group title={t('helpInfo')}>
          <MenuRow to="/support" icon={<LifeBuoy className="size-5" />} label={t('support')} />
          <MenuRow to="/account/about-us" icon={<Building2 className="size-5" />} label={t('aboutUs')} />
          <MenuRow to="/account/terms" icon={<FileText className="size-5" />} label={t('termsTitle')} />
          <MenuRow to="/account/privacy" icon={<Lock className="size-5" />} label={t('privacyTitle')} />
          <MenuRow to="/account/careers" icon={<Briefcase className="size-5" />} label={t('workWithUs')} />
          <MenuRow to="/account/settings#about" icon={<Info className="size-5" />} label={t('about')} value={<bdi dir="ltr">v{__APP_VERSION__}</bdi>} />
        </Group>

        <Group>
          <MenuRow tone="danger" onClick={async () => { await removeMyToken().catch(() => {}); await signOut() }} icon={<LogOut className="size-5 rtl:-scale-x-100" />} label={t('signOut')} />
        </Group>
      </div>

      <Sheet open={sharing} onClose={() => setSharing(false)}>
        {sharing && <ShareApp onDone={() => setSharing(false)} />}
      </Sheet>
    </div>
  )
}
