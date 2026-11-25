import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'
import { assetUrl, cn } from '../lib/format'
import { LANGS } from '../lib/i18n'

export default function Login() {
  const { t, lang, setLang } = usePrefs()
  const toast = useToast()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [f, setF] = useState({ email: '', password: '', full_name: '', phone: '', shop_name: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: f.email.trim(), password: f.password,
          options: { data: { full_name: f.full_name, phone: f.phone, shop_name: f.shop_name } }
        })
        if (error) throw error
        if (!data.session) { setMsg(t('checkEmail')); setMode('in') }
      }
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally { setBusy(false) }
  }

  async function forgot() {
    if (!f.email) { toast(t('email') + '?', 'error'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim())
    toast(error ? error.message : t('resetSent'), error ? 'error' : 'success')
  }

  const nextLang = LANGS[(LANGS.findIndex(l => l.code === lang) + 1) % LANGS.length]

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* decorative colour field */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rotate-45 rounded-[90px] opacity-[0.13] blur-2xl sanad-stripe" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 safe-top">
        <div className="flex justify-end pt-4">
          <button onClick={() => setLang(nextLang.code)} className="chip surface border border-theme py-2 text-sm">
            <Globe className="size-4" /> {nextLang.label}
          </button>
        </div>

        <div className="rise mt-4 flex flex-col items-center text-center">
          <div className="rounded-[36px] bg-white p-5 shadow-xl shadow-black/5">
            <img src={assetUrl('brands/sanad.png')} alt="Sanad Company" className="h-36 w-auto" />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight">Sanad Order</h1>
          <p className="mt-1 text-sm text-2">{t('tagline')}</p>
          <div className="mt-4 h-1.5 w-24 rounded-full sanad-stripe" />
        </div>

        <div className="rise card mt-8 p-5" style={{ animationDelay: '80ms' }}>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl surface-2 p-1">
            {(['in', 'up'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={cn('rounded-xl py-2.5 text-sm font-bold transition', mode === m ? 'surface shadow' : 'text-2')}>
                {m === 'in' ? t('signIn') : t('signUp')}
              </button>
            ))}
          </div>
          {msg && <p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{msg}</p>}
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'up' && (
              <>
                <div><label className="label">{t('fullName')}</label><input required className="field" value={f.full_name} onChange={set('full_name')} autoComplete="name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{t('phone')}</label><input required className="field" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
                  <div><label className="label">{t('shopName')}</label><input className="field" value={f.shop_name} onChange={set('shop_name')} /></div>
                </div>
              </>
            )}
            <div><label className="label">{t('email')}</label><input required type="email" dir="ltr" className="field" value={f.email} onChange={set('email')} autoComplete="email" /></div>
            <div>
              <label className="label">{t('password')}</label>
              <div className="relative">
                <input required minLength={6} type={show ? 'text' : 'password'} dir="ltr" className="field pe-12" value={f.password} onChange={set('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
                <button type="button" aria-label="show password" onClick={() => setShow(!show)} className="absolute inset-y-0 end-0 grid w-12 place-items-center text-2">
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
            <button disabled={busy} className="btn btn-primary mt-2 w-full py-4 text-base">
              {busy && <Spinner />} {mode === 'in' ? t('signIn') : t('signUp')}
            </button>
            {mode === 'in' && <button type="button" onClick={forgot} className="w-full pt-1 text-center text-sm font-semibold text-2">{t('forgot')}</button>}
          </form>
        </div>
        <p className="mt-auto pt-8 text-center text-xs text-2">© Sanad Company</p>
      </div>
    </div>
  )
}
