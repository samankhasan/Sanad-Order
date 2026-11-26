import { useState, type FormEvent } from 'react'
import { AtSign, Home, LogOut, Phone, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'
import CitySelect from '../components/CitySelect'
import { assetUrl } from '../lib/format'
import { isPhoneAccount, normalizePhone } from '../lib/identity'

/** Customers signed in with Google (or older accounts) fill in what we need to deliver. */
export function needsProfileCompletion(p: { role: string; username?: string | null; phone?: string | null; city?: string | null; address?: string | null } | null) {
  return !!p && p.role === 'customer' && (!p.username || !p.phone || !p.city || !p.address)
}

function suggestUsername(email?: string | null, name?: string | null) {
  const base = (email && !isPhoneAccount(email) ? email.split('@')[0] : name ?? '').toLowerCase()
  return base.normalize('NFKD').replace(/[^a-z0-9._]/g, '').slice(0, 24)
}

export default function CompleteProfile() {
  const { t } = usePrefs()
  const { session, profile, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string }
  const email = session?.user.email
  const [f, setF] = useState({
    full_name: profile?.full_name || meta.full_name || meta.name || '',
    username: profile?.username || suggestUsername(email, meta.full_name || meta.name),
    phone: profile?.phone ? '+' + profile.phone : '',
    city: profile?.city || '',
    address: profile?.address || ''
  })
  const [busy, setBusy] = useState(false)
  const avatar = meta.avatar_url || meta.picture
  const iconCls = 'pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    try {
      const username = f.username.trim().toLowerCase()
      if (username !== (profile?.username ?? '')) {
        const { data: free } = await supabase.rpc('username_available', { p_username: username })
        if (!free) { toast(t('usernameTaken'), 'error'); return }
      }
      const { error } = await supabase.from('profiles').update({
        full_name: f.full_name.trim(), username, phone: normalizePhone(f.phone), city: f.city, address: f.address.trim()
      }).eq('id', session.user.id)
      if (error) throw error
      await refreshProfile()
    } catch (err) { const m = (err as Error).message; toast(/account_blocked/.test(m) ? t('accountBlocked') : m, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rotate-45 rounded-[90px] opacity-[0.12] blur-2xl sanad-stripe" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-g pb-[calc(var(--sab)+24px)] pt-[calc(var(--sat)+24px)]">
        <div className="rise flex flex-col items-center text-center">
          <div className="relative">
            {avatar
              ? <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-20 rounded-full object-cover shadow-lg ring-4 ring-white" />
              : <span className="grid size-20 place-items-center rounded-full bg-ink text-2xl font-black text-white shadow-lg ring-4 ring-white">{(f.full_name || '?').slice(0, 1).toUpperCase()}</span>}
            <img src={assetUrl('brands/sanad-mark.png')} alt="" className="absolute -bottom-1 -end-1 size-8 rounded-full bg-white p-1 shadow" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight">{t('completeProfile')}</h1>
          <p className="mt-1 max-w-xs text-sm text-2">{t('completeProfileHint')}</p>
          {email && !isPhoneAccount(email) && <p className="mt-2 chip surface border border-theme text-2">{t('signedInAs')} <span dir="ltr" className="font-bold">{email}</span></p>}
        </div>

        <form onSubmit={submit} className="rise card mt-6 space-y-3 p-4 xs:p-5" style={{ animationDelay: '80ms' }}>
          <div className="relative">
            <UserRound className={iconCls} />
            <input required className="field ps-12" placeholder={t('fullName')} aria-label={t('fullName')} value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} autoComplete="name" />
          </div>
          <div>
            <div className="relative">
              <AtSign className={iconCls} />
              <input required dir="ltr" pattern="[a-z0-9._]{3,30}" maxLength={30} className="field px-12 text-start rtl:text-right" placeholder={t('username')} aria-label={t('username')}
                value={f.username} onChange={e => setF({ ...f, username: e.target.value.replace(/[^A-Za-z0-9._]/g, '').toLowerCase() })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>
            <p className="mt-1 px-1 text-[11px] text-2">{t('usernameHint')}</p>
          </div>
          <div>
            <div className="relative">
              <Phone className={iconCls} />
              <input required type="tel" dir="ltr" className="field px-12 text-start rtl:text-right" placeholder={t('phone')} aria-label={t('phone')}
                value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
            </div>
            <p className="mt-1 px-1 text-[11px] text-2">{t('phoneHint')}</p>
          </div>
          <p className="label !mb-0 pt-1">{t('address')}</p>
          <CitySelect required withIcon value={f.city} onChange={city => setF({ ...f, city })} />
          <div className="relative">
            <Home className="pointer-events-none absolute start-4 top-4 size-5 text-2" />
            <textarea required rows={2} className="field resize-none ps-12" placeholder={t('fullAddress')} aria-label={t('fullAddress')}
              value={f.address} onChange={e => setF({ ...f, address: e.target.value })} autoComplete="street-address" />
          </div>
          <button disabled={busy} className="btn btn-primary mt-1 min-h-14 w-full text-base">{busy && <Spinner />}{t('continueBtn')}</button>
        </form>

        <button onClick={signOut} className="mx-auto mt-4 flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-2">
          <LogOut className="size-4 rtl:-scale-x-100" />{t('useAnotherAccount')}
        </button>
      </div>
    </div>
  )
}
