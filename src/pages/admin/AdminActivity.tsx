import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Bell, ClipboardList, CreditCard, Gift, Image, KeyRound, LayoutGrid, Mail, MessageSquare, Package, Pencil, Plus, ReceiptText, Star, Trash2, Trophy, UserPlus, UserRound, UserCheck } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { supabase } from '../../lib/supabase'
import { useCategories } from '../../lib/data'
import { cn, money } from '../../lib/format'
import { ErrorBox, Skeleton, Spinner } from '../../components/ui'
import type { TKey } from '../../lib/i18n'

interface Entry {
  id: number
  at: string
  actor: string | null
  action: string
  entity: string
  entity_id: string | null
  label: string | null
  changes: Record<string, [unknown, unknown]> | null
  profiles: { full_name: string | null; avatar_url: string | null; role: string } | null
}
type Staff = { id: string; full_name: string | null; role: string }

const PAGE = 60
// filter chips → which entities they cover
const GROUPS: { key: string; label: TKey; entities: string[] }[] = [
  { key: 'all', label: 'acAll', entities: [] },
  { key: 'orders', label: 'acOrders', entities: ['orders'] },
  { key: 'products', label: 'acProducts', entities: ['products', 'categories', 'subcategories'] },
  { key: 'members', label: 'acMembers', entities: ['member', 'profiles'] },
  { key: 'rewards', label: 'acRewards', entities: ['rewards', 'challenges'] },
  { key: 'messages', label: 'acMessages', entities: ['support_messages', 'product_reviews', 'notification'] },
  { key: 'settings', label: 'acSettings', entities: ['payment_methods', 'home_banners'] }
]
const ENTITY_ICON: Record<string, typeof Package> = {
  products: Package, categories: LayoutGrid, subcategories: LayoutGrid, orders: ReceiptText, profiles: UserRound, member: UserRound,
  rewards: Gift, challenges: Trophy, payment_methods: CreditCard, home_banners: Image, product_reviews: Star, support_messages: MessageSquare, notification: Bell
}
const ACTION_ICON: Record<string, typeof Package> = {
  insert: Plus, update: Pencil, delete: Trash2, block: Ban, unblock: UserCheck, delete_member: Trash2, set_password: KeyRound, set_email: Mail, create_member: UserPlus, send: Bell
}
const ACTION_TONE: Record<string, string> = {
  insert: 'bg-emerald-500', create_member: 'bg-emerald-500', update: 'bg-sky-500', set_email: 'bg-sky-500', set_password: 'bg-amber-500',
  delete: 'bg-rose-500', delete_member: 'bg-rose-500', block: 'bg-rose-600', unblock: 'bg-emerald-600', send: 'bg-violet-500'
}
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'created_by', 'user_id', 'avatar_url'])

/** Admin → Activity: who changed what and when, with old → new values. */
export default function AdminActivity() {
  const { t, lang, catName } = usePrefs()
  const { categories } = useCategories()
  const [rows, setRows] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [group, setGroup] = useState('all')
  const [actor, setActor] = useState('')
  const [staff, setStaff] = useState<Staff[]>([])
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'operator']).order('full_name').then(({ data }) => setStaff((data as Staff[]) ?? []))
  }, [])

  const fetchPage = useCallback(async (before?: number) => {
    let q = supabase.from('audit_log').select('*, profiles(full_name, avatar_url, role)').order('id', { ascending: false }).limit(PAGE)
    const g = GROUPS.find(x => x.key === group)
    if (g?.entities.length) q = q.in('entity', g.entities)
    if (actor) q = q.eq('actor', actor)
    if (before) q = q.lt('id', before)
    return q
  }, [group, actor])

  const load = useCallback(async () => {
    setRows(null); setError(null)
    const { data, error } = await fetchPage()
    if (error) { setError(error.message); return }
    setRows(data as Entry[]); setMore((data?.length ?? 0) === PAGE)
  }, [fetchPage])
  useEffect(() => { load() }, [load])

  async function loadMore() {
    if (!rows?.length) return
    setBusy(true)
    const { data } = await fetchPage(rows[rows.length - 1].id)
    setBusy(false)
    setRows(r => [...(r ?? []), ...((data as Entry[]) ?? [])]); setMore((data?.length ?? 0) === PAGE)
  }

  // translation with a fallback when the key doesn't exist (t() returns the key itself then)
  const tr = (key: string, fallback: string) => { const v = t(key as TKey); return v && v !== key ? v : fallback }
  const fieldName = (f: string) => tr(`fld_${f}`, f)
  function fmt(field: string, v: unknown): string {
    if (v == null || v === '') return '—'
    if (typeof v === 'boolean') return v ? t('acYes') : t('acNo')
    if (field === 'status') return tr(`status_${v}`, String(v))
    if (field === 'role') return tr(`role_${v}`, String(v))
    if (field === 'payment_status') return v === 'paid' ? t('paid') : t('unpaid')
    if (field === 'price' || field === 'total') return money(Number(v), lang)
    if (field === 'category_id') { const c = categories?.find(x => x.id === v); return c ? catName(c) : '—' }
    if (field === 'blocked_at') return t('acYes')
    if (/image_url|logo/.test(field)) return t('acPicture')
    if (/_at$/.test(field)) return new Date(String(v)).toLocaleString(lang === 'en' ? 'en-GB' : 'ar-IQ', { numberingSystem: 'latn', dateStyle: 'medium' } as Intl.DateTimeFormatOptions)
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return s.length > 80 ? s.slice(0, 78) + '…' : s
  }

  const entityName = (e: string) => tr(`ent_${e}`, e)
  const verb = (a: string) => tr(`act_${a}`, a)

  // group by calendar day
  const days = useMemo(() => {
    const m = new Map<string, Entry[]>()
    ;(rows ?? []).forEach(r => { const k = new Date(r.at).toDateString(); m.set(k, [...(m.get(k) ?? []), r]) })
    return [...m.entries()]
  }, [rows])
  const dayLabel = (k: string) => {
    const d = new Date(k), today = new Date(); today.setHours(0, 0, 0, 0)
    const diff = Math.round((today.getTime() - d.getTime()) / 864e5)
    if (diff === 0) return t('today')
    if (diff === 1) return t('yesterday')
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions)
  }
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ar-IQ', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions)

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 basis-60 gap-2 overflow-x-auto">
          {GROUPS.map(g => (
            <button key={g.key} onClick={() => setGroup(g.key)} className={cn('filter-chip shrink-0', group === g.key && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>{t(g.label)}</button>
          ))}
        </div>
        <select value={actor} onChange={e => setActor(e.target.value)} className="field !min-h-11 w-auto max-w-[12rem] py-2 text-sm" aria-label={t('acWho')}>
          <option value="">{t('acEveryone')}</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || '—'} · {t(`role_${s.role}` as TKey)}</option>)}
        </select>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <div className="space-y-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-3xl" />)}</div>}
      {rows?.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-8 py-14 text-center text-2">
          <ClipboardList className="size-10" /><p className="text-sm font-semibold">{t('acEmpty')}</p>
        </div>
      )}

      {days.map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-2">{dayLabel(day)}</h2>
          <ol className="card divide-y divide-[var(--border)] overflow-hidden">
            {list.map(r => {
              const EIcon = ENTITY_ICON[r.entity] ?? ClipboardList
              const AIcon = ACTION_ICON[r.action] ?? Pencil
              const changes = Object.entries(r.changes ?? {}).filter(([f]) => !HIDDEN_FIELDS.has(f))
              const who = r.profiles?.full_name || t('acSomeone')
              return (
                <li key={r.id} className="flex gap-3 p-4">
                  <div className="relative shrink-0 self-start">
                    <span className="grid size-11 place-items-center overflow-hidden rounded-2xl surface-2 text-sm font-black">
                      {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} alt="" className="size-full object-cover" /> : who.slice(0, 1)}
                    </span>
                    <span className={cn('absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-[var(--surface)]', ACTION_TONE[r.action] ?? 'bg-slate-500')}><AIcon className="size-3" /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6">
                      <b>{who}</b> <span className="text-2">{verb(r.action)}</span>{' '}
                      <span className="inline-flex items-center gap-1 align-middle text-xs font-bold text-2"><EIcon className="size-3.5" />{entityName(r.entity)}</span>
                      {r.label && <> <b className="break-words"><bdi>«{r.label}»</bdi></b></>}
                    </p>
                    {changes.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {changes.slice(0, 6).map(([f, [a, b]]) => (
                          <li key={f} className="flex flex-wrap items-center gap-x-1.5 text-xs">
                            <span className="font-bold text-2">{fieldName(f)}:</span>
                            <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-700 line-through decoration-rose-400/60 dark:bg-rose-500/10 dark:text-rose-300">{fmt(f, a)}</span>
                            <span className="text-2 rtl:-scale-x-100">→</span>
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{fmt(f, b)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] font-semibold text-2" dir="ltr" dateTime={r.at}>{time(r.at)}</time>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {more && (
        <button onClick={loadMore} disabled={busy} className="btn btn-ghost min-h-12 w-full">{busy ? <Spinner /> : null}{t('acLoadMore')}</button>
      )}
    </div>
  )
}
