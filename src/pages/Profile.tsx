import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Camera, ChevronLeft, ChevronRight, LifeBuoy, Download, LogOut, Moon, Sun, MonitorSmartphone, ShieldCheck, Smartphone, Trash2, FileText } from 'lucide-react'
import { removeAvatarFile, uploadAvatar } from '../lib/image'
import { displayIdentity, normalizePhone } from '../lib/identity'
import { ANDROID_APK_URL, isNativeApp } from '../lib/native'
import CitySelect from '../components/CitySelect'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { removeMyToken } from '../lib/push'
import { PageHeader, Spinner } from '../components/ui'
import { LANGS } from '../lib/i18n'
import { assetUrl, cn } from '../lib/format'

interface BIPEvent extends Event { prompt: () => Promise<void> }
let deferredPrompt: BIPEvent | null = null
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e as BIPEvent })

export default function Profile() {
  const { t, lang, setLang, theme, setTheme, dir } = usePrefs()
  const { profile, session, signOut, refreshProfile, isAdmin } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', username: '', phone: '', city: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)
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
  useEffect(() => {
    const h = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

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
      <PageHeader title={t('profile')} />
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

        <Link to="/support" className="card flex min-h-[72px] items-center gap-3 p-4 transition active:scale-[.99]">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white shadow-md"><LifeBuoy className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{t('support')}</p>
            <p className="truncate text-xs text-2">{t('supportShort')}</p>
          </div>
          {dir === 'rtl' ? <ChevronLeft className="size-5 text-2" /> : <ChevronRight className="size-5 text-2" />}
        </Link>

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

        <section className="card space-y-4 p-5">
          <div>
            <p className="label">{t('language')}</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)} className={cn('btn py-3 text-sm', lang === l.code ? 'btn-primary' : 'btn-ghost')}>{l.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{t('theme')}</p>
            <div className="grid grid-cols-3 gap-2">
              {([['light', Sun], ['dark', Moon], ['system', MonitorSmartphone]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setTheme(k)} className={cn('btn py-3 text-sm', theme === k ? 'btn-primary' : 'btn-ghost')}><Icon className="size-4" />{t(k)}</button>
              ))}
            </div>
          </div>
        </section>

        {canInstall && (
          <button onClick={async () => { await deferredPrompt?.prompt(); deferredPrompt = null; setCanInstall(false) }} className="btn btn-ghost w-full">
            <Download className="size-5" />{t('install')}
          </button>
        )}
        <button onClick={async () => { await removeMyToken(); await signOut() }} className="btn btn-danger w-full"><LogOut className="size-5 rtl:-scale-x-100" />{t('signOut')}</button>
        {!isNativeApp && <a href={ANDROID_APK_URL} className="btn btn-ghost w-full"><Smartphone className="size-5 text-s-green" />{t('getAndroidApp')}</a>}
        <a href="./privacy.html" target="_blank" rel="noreferrer" className="btn btn-ghost w-full"><FileText className="size-5" />{t('privacy')}</a>
        <button onClick={deleteAccount} className="min-h-12 w-full text-sm font-bold text-rose-600"><Trash2 className="me-1 inline size-4" />{t('deleteAccount')}</button>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <img src={assetUrl('brands/sanad-mark.png')} alt="" className="h-10" />
          <p className="text-xs text-2">Sanad Order · v1.6.2</p>
        </div>
      </div>
    </div>
  )
}
