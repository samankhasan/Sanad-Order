import { useEffect, useMemo, useState } from 'react'
import { Phone, Search, ShieldCheck, Store } from 'lucide-react'
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

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter(p => !s || [p.full_name, p.shop_name, p.phone, p.city].some(v => v?.toLowerCase().includes(s)))
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
              {p.shop_name && <span className="chip surface-2"><Store className="size-3.5" />{p.shop_name}</span>}
              {p.phone && <a href={`tel:${p.phone}`} className="chip surface-2" dir="ltr"><Phone className="size-3.5" />{p.phone}</a>}
              {p.city && <span className="chip surface-2">{p.city}</span>}
            </div>
            {p.id !== session?.user.id && (
              <button onClick={() => toggleRole(p)} className="mt-3 text-xs font-bold text-brand">{p.role === 'admin' ? t('removeAdmin') : t('makeAdmin')}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
