import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AtSign, Ban, KeyRound, Mail, MapPin, Pencil, Phone, Search, ShieldCheck, Trash2, UserRound, Home as HomeIcon } from 'lucide-react'
import { placeLabel } from '../../lib/iraq'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { ErrorBox, Sheet, Skeleton, Spinner } from '../../components/ui'
import CitySelect from '../../components/CitySelect'
import { cn, dateTime } from '../../lib/format'
import { normalizePhone } from '../../lib/identity'
import type { Profile } from '../../lib/types'

type Filter = 'all' | 'blocked' | 'admin'

async function account(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('account', { body })
  if (error || data?.error) throw new Error(error?.message || data.error)
  return data
}

function EditMember({ member, onClose, onSaved }: { member: Profile; onClose: () => void; onSaved: () => void }) {
  const { t } = usePrefs()
  const toast = useToast()
  const [f, setF] = useState({
    full_name: member.full_name ?? '', username: member.username ?? '', phone: member.phone ? `+${member.phone}` : '',
    city: member.city ?? '', address: member.address ?? '', email: ''
  })
  const [origEmail, setOrigEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    account({ action: 'admin_get_user', user_id: member.id }).then(d => {
      const e = (d.email as string | null) ?? ''
      const shown = e.endsWith('@phone.sanadorder.app') ? '' : e
      setOrigEmail(shown); setF(s => ({ ...s, email: shown }))
    }).catch(() => setOrigEmail(''))
  }, [member.id])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const username = f.username.trim().toLowerCase() || null
      if (username && username !== (member.username ?? '').toLowerCase()) {
        const { data: free } = await supabase.rpc('username_available', { p_username: username })
        if (!free) { toast(t('usernameTaken'), 'error'); return }
      }
      const { error } = await supabase.from('profiles').update({
        full_name: f.full_name.trim() || null,
        username,
        phone: f.phone.trim() ? normalizePhone(f.phone) : null,
        city: f.city || null,
        address: f.address.trim() || null
      }).eq('id', member.id)
      if (error) throw error
      const email = f.email.trim().toLowerCase()
      if (origEmail !== null && email && email !== origEmail) await account({ action: 'admin_set_email', user_id: member.id, email })
      toast(t('memberSaved')); onSaved(); onClose()
    } catch (err) {
      const m = (err as Error).message
      toast(/duplicate key|profiles_username/.test(m) ? t('usernameTaken') : m, 'error')
    } finally { setBusy(false) }
  }

  const icon = 'pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2'
  return (
    <form onSubmit={save} className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Pencil className="size-5" />{t('editMember')}</h2>
      <div className="relative"><UserRound className={icon} />
        <input required className="field ps-12" placeholder={t('fullName')} aria-label={t('fullName')} value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></div>
      <div className="relative"><AtSign className={icon} />
        <input dir="ltr" pattern="[a-z0-9._]{3,30}" maxLength={30} className="field px-12 text-start rtl:text-right" placeholder={t('username')} aria-label={t('username')}
          value={f.username} onChange={e => setF({ ...f, username: e.target.value.replace(/[^A-Za-z0-9._]/g, '').toLowerCase() })} autoCapitalize="none" spellCheck={false} /></div>
      <div className="relative"><Phone className={icon} />
        <input type="tel" dir="ltr" className="field px-12 text-start rtl:text-right" placeholder={t('phone')} aria-label={t('phone')} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div>
        <div className="relative"><Mail className={icon} />
          <input type="email" dir="ltr" disabled={origEmail === null} className="field px-12 text-start rtl:text-right" placeholder={t('emailLogin')} aria-label={t('emailLogin')} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        {origEmail === null && <p className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-2"><Spinner className="size-3" />{t('emailLogin')}</p>}
      </div>
      <p className="label !mb-0 pt-1">{t('address')}</p>
      <CitySelect withIcon value={f.city} onChange={city => setF({ ...f, city })} />
      <div className="relative">
        <HomeIcon className="pointer-events-none absolute start-4 top-4 size-5 text-2" />
        <textarea rows={2} className="field resize-none ps-12" placeholder={t('fullAddress')} aria-label={t('fullAddress')} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
      </div>
      <button disabled={busy} className="btn btn-primary min-h-14 w-full text-base">{busy && <Spinner />}{t('save')}</button>
    </form>
  )
}

export default function AdminCustomers() {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data as Profile[])
  }
  useEffect(() => { load() }, [])

  async function run(p: Profile, fn: () => Promise<unknown>) {
    setBusy(p.id)
    try { await fn(); toast(t('saved')); await load() }
    catch (e) { const m = (e as Error).message; toast(m === 'remove_admin_first' ? t('removeAdminFirst') : m, 'error') }
    finally { setBusy(null) }
  }

  function toggleRole(p: Profile) {
    const role = p.role === 'admin' ? 'customer' : 'admin'
    if (!confirm(role === 'admin' ? t('makeAdmin') + '?' : t('removeAdmin') + '?')) return
    run(p, async () => { const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id); if (error) throw error })
  }
  function resetPassword(p: Profile) {
    const pw = prompt(`${p.full_name ?? ''}\n${t('newPasswordPrompt')}`)
    if (pw) run(p, () => account({ action: 'admin_set_password', user_id: p.id, password: pw }))
  }
  function toggleBlock(p: Profile) {
    const blocked = !p.blocked_at
    if (!confirm(`${p.full_name ?? ''}\n${blocked ? t('blockConfirm') : t('unblockConfirm')}`)) return
    run(p, () => account({ action: 'admin_block', user_id: p.id, blocked }))
  }
  function remove(p: Profile) {
    if (!confirm(`${p.full_name ?? ''}\n${t('deleteMemberConfirm')}`)) return
    run(p, () => account({ action: 'admin_delete_user', user_id: p.id }))
  }

  const counts = useMemo(() => ({
    all: rows?.length ?? 0,
    blocked: rows?.filter(p => p.blocked_at).length ?? 0,
    admin: rows?.filter(p => p.role === 'admin').length ?? 0
  }), [rows])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? [])
      .filter(p => filter === 'all' || (filter === 'blocked' ? !!p.blocked_at : p.role === 'admin'))
      .filter(p => !s || [p.full_name, p.username, p.phone, p.city, p.address, placeLabel(p.city, lang)].some(v => v?.toLowerCase().includes(s)))
  }, [rows, q, filter, lang])

  const actionCls = 'flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold active:bg-[var(--surface-2)] disabled:opacity-40'

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12" />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {([['all', t('allMembers')], ['blocked', t('blocked')], ['admin', t('admin')]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn('filter-chip', filter === k && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>
            {label} <span className="opacity-70" dir="ltr">{counts[k]}</span>
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && <Skeleton className="h-96 rounded-3xl" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map(p => {
          const self = p.id === session?.user.id
          const isBlocked = !!p.blocked_at
          return (
            <div key={p.id} className={cn('card p-4', isBlocked && 'ring-2 ring-rose-500/40')}>
              <div className="flex items-start gap-3">
                <div className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-black', isBlocked ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'surface-2')}>
                  {isBlocked ? <Ban className="size-6" /> : (p.full_name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-extrabold">
                    <span className="truncate">{p.full_name || '—'}</span>
                    {p.role === 'admin' && <ShieldCheck className="size-4 shrink-0 text-emerald-600" />}
                    {isBlocked && <span className="chip shrink-0 bg-rose-100 !py-0.5 text-[11px] text-rose-700 dark:bg-rose-950 dark:text-rose-300">{t('blocked')}</span>}
                  </p>
                  <p className="text-xs text-2">{dateTime(p.created_at, lang)}</p>
                </div>
                {busy === p.id && <Spinner />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {p.username && <span className="chip surface-2" dir="ltr"><AtSign className="size-3.5" />{p.username}</span>}
                {p.phone && <a href={`tel:+${p.phone}`} className="chip min-h-9 surface-2" dir="ltr"><Phone className="size-3.5" />+{p.phone}</a>}
              </div>
              {(p.city || p.address) && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-2"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span><b>{placeLabel(p.city, lang)}</b>{p.address && ` — ${p.address}`}</span></p>
              )}
              <div className="mt-2 flex flex-wrap gap-0.5 border-t border-theme pt-2">
                <button onClick={() => setEditing(p)} className={cn(actionCls, 'text-brand')}><Pencil className="size-4" />{t('edit')}</button>
                {!self && <>
                  <button disabled={!!busy} onClick={() => resetPassword(p)} className={cn(actionCls, 'text-2')}><KeyRound className="size-4" />{t('resetPassword')}</button>
                  {p.role !== 'admin' && <button disabled={!!busy} onClick={() => toggleBlock(p)} className={cn(actionCls, isBlocked ? 'text-emerald-600' : 'text-amber-600')}><Ban className="size-4" />{isBlocked ? t('unblock') : t('block')}</button>}
                  <button disabled={!!busy || isBlocked} onClick={() => toggleRole(p)} className={cn(actionCls, 'text-2')}><ShieldCheck className="size-4" />{p.role === 'admin' ? t('removeAdmin') : t('makeAdmin')}</button>
                  {p.role !== 'admin' && <button disabled={!!busy} onClick={() => remove(p)} className={cn(actionCls, 'text-rose-600')}><Trash2 className="size-4" />{t('deleteMember')}</button>}
                </>}
              </div>
            </div>
          )
        })}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <EditMember member={editing} onClose={() => setEditing(null)} onSaved={load} />}
      </Sheet>
    </div>
  )
}
