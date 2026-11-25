import { useEffect, useState } from 'react'
import { Download, LogOut, Moon, Sun, MonitorSmartphone, ShieldCheck, Trash2, FileText } from 'lucide-react'
import { displayIdentity } from '../lib/identity'
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
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const { profile, session, signOut, refreshProfile, isAdmin } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', phone: '', shop_name: '', city: '' })
  const [busy, setBusy] = useState(false)
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)

  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', shop_name: profile.shop_name ?? '', city: profile.city ?? '' })
  }, [profile])
  useEffect(() => {
    const h = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  async function save() {
    if (!session) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update(f).eq('id', session.user.id)
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
          <div className="grid size-16 place-items-center rounded-3xl bg-ink text-2xl font-black text-white dark:bg-white dark:text-ink">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{profile?.full_name || '—'}</p>
            <p className="truncate text-sm text-2" dir="ltr">{displayIdentity(session?.user.email, profile?.phone)}</p>
            {isAdmin && <span className="chip mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck className="size-3.5" />Admin</span>}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-extrabold">{t('editProfile')}</h2>
          <div><label className="label">{t('fullName')}</label><input className="field" value={f.full_name} onChange={set('full_name')} /></div>
          <div className="grid gap-3 xs:grid-cols-2">
            <div><label className="label">{t('phone')}</label><input className="field" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
            <div><label className="label">{t('city')}</label><input className="field" value={f.city} onChange={set('city')} /></div>
          </div>
          <div><label className="label">{t('shopName')}</label><input className="field" value={f.shop_name} onChange={set('shop_name')} /></div>
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
        <a href="./privacy.html" target="_blank" rel="noreferrer" className="btn btn-ghost w-full"><FileText className="size-5" />{t('privacy')}</a>
        <button onClick={deleteAccount} className="min-h-12 w-full text-sm font-bold text-rose-600"><Trash2 className="me-1 inline size-4" />{t('deleteAccount')}</button>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <img src={assetUrl('brands/sanad-mark.png')} alt="" className="h-10" />
          <p className="text-xs text-2">Sanad Order · v1.2.1</p>
        </div>
      </div>
    </div>
  )
}
