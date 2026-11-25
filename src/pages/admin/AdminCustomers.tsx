import { useEffect, useMemo, useState } from 'react'
import { AtSign, KeyRound, MapPin, Phone, Search, ShieldCheck } from 'lucide-react'
import { placeLabel } from '../../lib/iraq'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { ErrorBox, Skeleton } from '../../components/ui'
import { dateTime } from '../../lib/format'
import type { Profile } from '../../lib/types'

export default function AdminCustomers() {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data as Profile[])
  }
  useEffect(() => { load() }, [])

  async function toggleRole(p: Profile) {
    const role = p.role === 'admin' ? 'customer' : 'admin'
    if (!confirm(role === 'admin' ? t('makeAdmin') + '?' : t('removeAdmin') + '?')) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); load() }
  }

  async function resetPassword(p: Profile) {
    const pw = prompt(`${p.full_name ?? ''}\n${t('newPasswordPrompt')}`)
    if (!pw) return
    const { data, error } = await supabase.functions.invoke('account', { body: { action: 'admin_set_password', user_id: p.id, password: pw } })
    if (error || data?.error) toast(error?.message || data.error, 'error'); else toast(t('saved'))
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter(p => !s || [p.full_name, p.username, p.phone, p.city, p.address, placeLabel(p.city, lang)].some(v => v?.toLowerCase().includes(s)))
  }, [rows, q])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12" />
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && <Skeleton className="h-96 rounded-3xl" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl surface-2 text-lg font-black">{(p.full_name || '?').slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-extrabold">{p.full_name || '—'}{p.role === 'admin' && <ShieldCheck className="size-4 text-emerald-600" />}</p>
                <p className="text-xs text-2">{dateTime(p.created_at, lang)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {p.username && <span className="chip surface-2" dir="ltr"><AtSign className="size-3.5" />{p.username}</span>}
              {p.phone && <a href={`tel:+${p.phone}`} className="chip min-h-9 surface-2" dir="ltr"><Phone className="size-3.5" />+{p.phone}</a>}
            </div>
            {(p.city || p.address) && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-2"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span><b>{placeLabel(p.city, lang)}</b>{p.address && ` — ${p.address}`}</span></p>
            )}
            {p.id !== session?.user.id && (
              <div className="mt-2 flex flex-wrap gap-1">
                <button onClick={() => resetPassword(p)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-brand active:bg-[var(--surface-2)]"><KeyRound className="size-4" />{t('resetPassword')}</button>
                <button onClick={() => toggleRole(p)} className="min-h-11 rounded-xl px-2 text-xs font-bold text-2 active:bg-[var(--surface-2)]">{p.role === 'admin' ? t('removeAdmin') : t('makeAdmin')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
