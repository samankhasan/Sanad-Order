import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Globe, Lock, Phone, Store, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'
import { assetUrl, cn } from '../lib/format'
import { LANGS } from '../lib/i18n'
import { isEmail, normalizePhone, toAuthEmail } from '../lib/identity'

export default function Login() {
  const { t, lang, setLang } = usePrefs()
  const toast = useToast()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [f, setF] = useState({ id: '', password: '', full_name: '', shop_name: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  function niceError(msg: string) {
    if (/invalid login credentials/i.test(msg)) return t('invalidLogin')
    if (/already registered|already exists/i.test(msg)) return t('alreadyRegistered')
    return msg
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const email = toAuthEmail(f.id)
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.password })
        if (error) throw error
      } else {
        const phone = isEmail(f.id) ? null : normalizePhone(f.id)
        const { data, error } = await supabase.auth.signUp({
          email, password: f.password,
          options: { data: { full_name: f.full_name.trim(), phone, shop_name: f.shop_name.trim() || null } }
        })
        if (error) throw error
        // no e-mail verification: sign straight in
        if (!data.session) {
          const r = await supabase.auth.signInWithPassword({ email, password: f.password })
          if (r.error) throw r.error
        }
      }
    } catch (err) {
      toast(niceError((err as Error).message), 'error')
    } finally { setBusy(false) }
  }

  async function forgot() {
    if (!isEmail(f.id)) { toast(t('forgotPhone'), 'error'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(f.id.trim())
    toast(error ? error.message : t('resetSent'), error ? 'error' : 'success')
  }

  const nextLang = LANGS[(LANGS.findIndex(l => l.code === lang) + 1) % LANGS.length]
  const iconCls = 'pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2'

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rotate-45 rounded-[90px] opacity-[0.13] blur-2xl sanad-stripe" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-g pb-[calc(var(--sab)+24px)] pt-[var(--sat)]">
        <div className="flex justify-end pt-2">
          <button onClick={() => setLang(nextLang.code)} className="chip min-h-11 surface border border-theme px-4 text-sm">
            <Globe className="size-4" /> {nextLang.label}
          </button>
        </div>

        <div className="rise mt-2 flex flex-col items-center text-center">
          <div className="rounded-[32px] bg-white p-4 shadow-xl shadow-black/5">
            <img src={assetUrl('brands/sanad.png')} alt="Sanad Company" className="h-24 w-auto xs:h-32" />
          </div>
          <h1 className="mt-4 text-[28px] font-black tracking-tight">Sanad Order</h1>
          <p className="mt-0.5 text-sm text-2">{t('tagline')}</p>
          <div className="mt-3 h-1.5 w-24 rounded-full sanad-stripe" />
        </div>

        <div className="rise card mt-6 p-4 xs:p-5" style={{ animationDelay: '80ms' }}>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl surface-2 p-1" role="tablist">
            {(['in', 'up'] as const).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn('min-h-11 rounded-xl text-sm font-bold transition', mode === m ? 'surface shadow' : 'text-2')}>
                {m === 'in' ? t('signIn') : t('signUp')}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'up' && (
              <div className="relative">
                <UserRound className={iconCls} />
                <input required className="field ps-12" placeholder={t('fullName')} aria-label={t('fullName')} value={f.full_name} onChange={set('full_name')} autoComplete="name" />
              </div>
            )}
            <div className="relative">
              <Phone className={iconCls} />
              <input required dir="ltr" className="field px-12 text-start rtl:text-right" inputMode={mode === 'up' ? 'tel' : 'email'}
                placeholder={mode === 'up' ? `${t('phone')} — ${t('phoneHint')}` : t('phoneOrEmail')} aria-label={t('phoneOrEmail')}
                value={f.id} onChange={set('id')} autoComplete={mode === 'up' ? 'tel' : 'username'} autoCapitalize="none" />
            </div>
            <div className="relative">
              <Lock className={iconCls} />
              <input required minLength={6} type={show ? 'text' : 'password'} dir="ltr" className="field px-12 text-start rtl:text-right"
                placeholder={mode === 'up' ? `${t('password')} — ${t('passwordHint')}` : t('password')} aria-label={t('password')}
                value={f.password} onChange={set('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
              <button type="button" aria-label="show password" onClick={() => setShow(!show)} className="absolute inset-y-0 end-0 grid w-12 place-items-center text-2">
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {mode === 'up' && (
              <div className="relative">
                <Store className={iconCls} />
                <input className="field ps-12" placeholder={t('shopOptional')} aria-label={t('shopOptional')} value={f.shop_name} onChange={set('shop_name')} />
              </div>
            )}
            <button disabled={busy} className="btn btn-primary mt-1 min-h-14 w-full text-base">
              {busy && <Spinner />} {mode === 'in' ? t('signIn') : t('signUp')}
            </button>
            {mode === 'in' && <button type="button" onClick={forgot} className="min-h-11 w-full text-center text-sm font-semibold text-2">{t('forgot')}</button>}
          </form>
        </div>
        <p className="mt-auto pt-6 text-center text-xs text-2">
          <span dir="ltr">Sanad Company © 2026</span> · <a href="./privacy.html" target="_blank" rel="noreferrer" className="underline">{t('privacy')}</a>
          <br /><span dir="ltr">Created by <a href="https://wa.me/9647508418593" target="_blank" rel="noreferrer" className="font-extrabold text-[#25D366]">Saman</a></span>
        </p>
      </div>
    </div>
  )
}
