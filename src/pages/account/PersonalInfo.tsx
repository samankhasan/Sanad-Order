import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BadgeCheck, Camera, KeyRound, Lock, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { removeAvatarFile, uploadAvatar } from '../../lib/image'
import { displayIdentity, isPhoneAccount, normalizePhone } from '../../lib/identity'
import CitySelect from '../../components/CitySelect'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { removeMyToken } from '../../lib/push'
import { PageHeader, Spinner } from '../../components/ui'

/** Account → Personal information: photo, name, username, phone, address, password, delete account. */
export default function PersonalInfo() {
  const { t } = usePrefs()
  const { profile, session, signOut, refreshProfile, isAdmin } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', username: '', phone: '', city: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ a: '', b: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  async function setPhoto(file: File | null) {
    if (!session) return
    setPhotoBusy(true)
    try {
      const old = profile?.avatar_url
      const url = file ? (await uploadAvatar(file, session.user.id)).url : null
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id)
      if (error) throw error
      await removeAvatarFile(old)
      await refreshProfile(); toast(t('saved'))
    } catch (e) { toast((e as Error).message, 'error') }
    setPhotoBusy(false)
  }

  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name ?? '', username: profile.username ?? '', phone: profile.phone ?? '', city: profile.city ?? '', address: profile.address ?? '' })
  }, [profile])
  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (pw.a.length < 6) { toast(t('passwordShort'), 'error'); return }
    if (pw.a !== pw.b) { toast(t('passwordsDiffer'), 'error'); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw.a })
    setPwBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setPw({ a: '', b: '' }); toast(t('passwordChanged'))
  }

  async function save() {
    if (!session) return
    const username = f.username.trim().toLowerCase()
    if (username && username !== (profile?.username ?? '')) {
      const { data: free } = await supabase.rpc('username_available', { p_username: username })
      if (!free) { toast(t('usernameTaken'), 'error'); return }
    }
    setBusy(true)
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name.trim() || null, username: username || null,
      phone: f.phone ? normalizePhone(f.phone) : null, city: f.city || null, address: f.address.trim() || null
    }).eq('id', session.user.id)
    setBusy(false)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); refreshProfile() }
  }

  async function deleteAccount() {
    if (!confirm(t('deleteAccountConfirm'))) return
    const { data, error } = await supabase.functions.invoke('account', { body: { action: 'delete_me' } })
    if (error || data?.error) { toast(error?.message || data.error, 'error'); return }
    await removeMyToken().catch(() => {})
    toast(t('accountDeleted'))
    await signOut()
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const initials = (profile?.full_name || session?.user.email || '?').slice(0, 1).toUpperCase()

  return (
    <div>
      <PageHeader back="/account" title={t('personalInfo')} />
      <div className="page-narrow px-g space-y-4">
        <section className="card flex items-center gap-4 p-5">
          <div className="relative shrink-0">
            <button onClick={() => photoRef.current?.click()} disabled={photoBusy} aria-label={t('changePhoto')}
              className="grid size-20 place-items-center overflow-hidden rounded-3xl bg-ink text-2xl font-black text-white dark:bg-white dark:text-ink">
              {photoBusy ? <Spinner /> : profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : initials}
            </button>
            <span className="pointer-events-none absolute -bottom-1 -end-1 grid size-8 place-items-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] ring-4 ring-[var(--surface)]"><Camera className="size-4" /></span>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) setPhoto(x); e.target.value = '' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{profile?.full_name || '—'}</p>
            <p className="truncate text-sm text-2" dir="ltr">{profile?.username ? `@${profile.username}` : displayIdentity(session?.user.email, profile?.phone)}</p>
            {isAdmin && <span className="chip mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck className="size-3.5" />{t('role_admin')}</span>}
            {profile?.role === 'operator' && <span className="chip mt-1 bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"><BadgeCheck className="size-3.5" />{t('role_operator')}</span>}
            {profile?.avatar_url && <button onClick={() => setPhoto(null)} disabled={photoBusy} className="mt-1 block min-h-9 text-xs font-bold text-rose-600">{t('removePhoto')}</button>}
          </div>
        </section>


        <section className="card space-y-3 p-5">
          <h2 className="font-extrabold">{t('editProfile')}</h2>
          <div><label className="label">{t('fullName')}</label><input className="field" value={f.full_name} onChange={set('full_name')} /></div>
          <div className="grid gap-3 xs:grid-cols-2">
            <div><label className="label">{t('username')}</label><input className="field" dir="ltr" autoCapitalize="none" maxLength={30} value={f.username} onChange={e => setF({ ...f, username: e.target.value.replace(/[^A-Za-z0-9._]/g, '').toLowerCase() })} /></div>
            <div><label className="label">{t('phone')}</label><input className="field" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
          </div>
          <div><label className="label">{t('selectCity')}</label><CitySelect value={f.city} onChange={city => setF({ ...f, city })} /></div>
          <div><label className="label">{t('fullAddress')}</label><textarea rows={2} className="field resize-none" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div>
          <button disabled={busy} onClick={save} className="btn btn-primary w-full">{busy && <Spinner />}{t('save')}</button>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Lock className="size-5" />{t('security')}</h2>
          {session?.user.email && !isPhoneAccount(session.user.email) && (
            <div>
              <p className="label">{t('signInEmail')}</p>
              <p className="flex min-h-12 items-center gap-2 rounded-2xl surface-2 px-4 text-sm font-semibold" dir="ltr"><Mail className="size-4 text-2" />{session.user.email}</p>
            </div>
          )}
          <form onSubmit={changePassword} className="space-y-3">
            <p className="label !mb-0">{t('changePassword')}</p>
            <input type="password" autoComplete="new-password" minLength={6} className="field" dir="ltr" placeholder={t('newPassword')} aria-label={t('newPassword')} value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value })} />
            <input type="password" autoComplete="new-password" minLength={6} className="field" dir="ltr" placeholder={t('confirmPassword')} aria-label={t('confirmPassword')} value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value })} />
            <button disabled={pwBusy || !pw.a || !pw.b} className="btn btn-ghost w-full">{pwBusy ? <Spinner /> : <KeyRound className="size-5" />}{t('changePassword')}</button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-extrabold text-rose-600">{t('dangerZone')}</h2>
          <p className="mb-3 text-xs leading-6 text-2">{t('deleteAccountConfirm')}</p>
          <button onClick={deleteAccount} className="btn btn-danger w-full"><Trash2 className="size-5" />{t('deleteAccount')}</button>
        </section>
      </div>
    </div>
  )
}
