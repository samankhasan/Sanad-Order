import { useEffect, useState, type FormEvent } from 'react'
import { AtSign, Download, Eye, EyeOff, Globe, Home, Lock, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePrefs } from '../context/PrefsContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'
import CitySelect from '../components/CitySelect'
import PasswordMeter from '../components/PasswordMeter'
import { PW_MIN, checkNewPassword, type PwIssue } from '../lib/password'
import GoogleButton from '../components/GoogleButton'
import { assetUrl, cn } from '../lib/format'
import { LANGS } from '../lib/i18n'
import { isEmail, normalizePhone } from '../lib/identity'
import { ANDROID_APK_URL, isNativeApp } from '../lib/native'

const SITE_URL = 'https://samankhasan.github.io/Sanad-Order/'
const empty = { id: '', password: '', full_name: '', username: '', email: '', phone: '', city: '', address: '' }
const LAST_LOGIN = 'so.lastLogin'

/** Ask the browser / phone password manager to save the login (Chrome & Android support this). */
async function savePassword(id: string, password: string, name?: string) {
  try { localStorage.setItem(LAST_LOGIN, id) } catch { /* ignore */ }
  try {
    const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential }).PasswordCredential
    if (PC && navigator.credentials?.store) await navigator.credentials.store(new PC({ id, password, name }))
  } catch { /* not supported — the browser's own save prompt still works */ }
}

export default function Login() {
  const { t, lang, setLang } = usePrefs()
  const toast = useToast()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [pwIssue, setPwIssue] = useState<PwIssue | null>(null)
  const [show, setShow] = useState(false)
  const [f, setF] = useState(() => {
    let id = ''
    try { id = localStorage.getItem(LAST_LOGIN) ?? '' } catch { /* ignore */ }
    return { ...empty, id }
  })

  // an error coming back from Google (or an expired link) is shown clearly
  useEffect(() => {
    try {
      const err = sessionStorage.getItem('so.authError')
      if (err) { sessionStorage.removeItem('so.authError'); toast(/provider is not enabled/i.test(err) ? t('googleNotReady') : /banned|account_blocked|database error saving new user/i.test(err) ? t('accountBlocked') : err, 'error') }
    } catch { /* ignore */ }
  }, [toast, t])

  // offer a saved password (Chrome / Android) to fill the form
  useEffect(() => {
    const nav = navigator as Navigator & { credentials?: { get?: (o: unknown) => Promise<Credential | null> } }
    if (!('PasswordCredential' in window) || !nav.credentials?.get) return
    nav.credentials.get({ password: true, mediation: 'optional' }).then(c => {
      const pc = c as (Credential & { password?: string }) | null
      if (pc?.id && pc.password) setF(s => ({ ...s, id: pc.id, password: pc.password! }))
    }).catch(() => {})
  }, [])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  function niceError(msg: string) {
    if (/banned|account_blocked|database error saving new user/i.test(msg)) return t('accountBlocked')
    if (/invalid login credentials/i.test(msg)) return t('invalidLogin')
    if (/already registered|already exists|duplicate key/i.test(msg)) return t('alreadyRegistered')
    return msg
  }

  /** username / e-mail / phone → the account's e-mail */
  async function resolveEmail(identifier: string) {
    if (isEmail(identifier)) return identifier.trim().toLowerCase()
    const { data, error } = await supabase.rpc('login_email', { p_identifier: identifier.trim() })
    if (error) throw error
    return (data as string | null) ?? null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'in') {
        const email = await resolveEmail(f.id)
        if (!email) throw new Error('Invalid login credentials')
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.password })
        if (error) throw error
        await savePassword(f.id.trim(), f.password)
      } else {
        const issue = await checkNewPassword(f.password)
        if (issue) { setPwIssue(issue); toast(t(issue), 'error'); return }
        const username = f.username.trim().toLowerCase()
        const { data: free } = await supabase.rpc('username_available', { p_username: username })
        if (!free) { toast(t('usernameTaken'), 'error'); return }
        const email = f.email.trim().toLowerCase()
        const { data, error } = await supabase.auth.signUp({
          email, password: f.password,
          options: { data: { full_name: f.full_name.trim(), username, phone: normalizePhone(f.phone), city: f.city, address: f.address.trim() } }
        })
        if (error) throw error
        if (!data.session) {
          const r = await supabase.auth.signInWithPassword({ email, password: f.password })
          if (r.error) throw r.error
        }
        await savePassword(username, f.password, f.full_name.trim())
      }
    } catch (err) {
      toast(niceError((err as Error).message), 'error')
    } finally { setBusy(false) }
  }

  async function forgot() {
    if (!f.id.trim()) { toast(t('enterLoginFirst'), 'error'); return }
    setBusy(true)
    try {
      const email = await resolveEmail(f.id)
      if (!email || email.endsWith('@phone.sanadorder.app')) { toast(t('forgotPhone'), 'error'); return }
      const redirectTo = isNativeApp ? SITE_URL : window.location.origin + window.location.pathname
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      toast(error ? error.message : t('resetSent'), error ? 'error' : 'success')
    } finally { setBusy(false) }
  }

  const nextLang = LANGS[(LANGS.findIndex(l => l.code === lang) + 1) % LANGS.length]
  const iconCls = 'pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2'
  const ltrField = 'field px-12 text-start rtl:text-right'

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
          <GoogleButton />
          <form onSubmit={submit} method="post" action="#" autoComplete="on" className="space-y-3">
            {mode === 'in' ? (
              <div className="relative">
                <UserRound className={iconCls} />
                <input required dir="ltr" className={ltrField} placeholder={t('loginId')} aria-label={t('loginId')}
                  id="username" name="username" value={f.id} onChange={set('id')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </div>
            ) : (
              <>
                <div className="relative">
                  <UserRound className={iconCls} />
                  <input required className="field ps-12" placeholder={t('fullName')} aria-label={t('fullName')} value={f.full_name} onChange={set('full_name')} autoComplete="name" />
                </div>
                <div>
                  <div className="relative">
                    <AtSign className={iconCls} />
                    <input required dir="ltr" className={ltrField} placeholder={t('username')} aria-label={t('username')} pattern="[A-Za-z0-9._]{3,30}"
                      value={f.username} onChange={e => setF({ ...f, username: e.target.value.replace(/[^A-Za-z0-9._]/g, '').toLowerCase() })}
                      id="new-username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} />
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-2">{t('usernameHint')}</p>
                </div>
                <div>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <input required type="email" dir="ltr" className={ltrField} placeholder={t('email')} aria-label={t('emailRecovery')}
                      value={f.email} onChange={set('email')} autoComplete="email" autoCapitalize="none" />
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-2">{t('emailHint')}</p>
                </div>
                <div>
                  <div className="relative">
                    <Phone className={iconCls} />
                    <input required type="tel" dir="ltr" className={ltrField} placeholder={t('phone')} aria-label={t('phone')}
                      value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" />
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-2">{t('phoneHint')}</p>
                </div>
              </>
            )}
            <div className="relative">
              <Lock className={iconCls} />
              <input required minLength={mode === 'up' ? PW_MIN : 6} type={show ? 'text' : 'password'} dir="ltr" className={ltrField}
                placeholder={t('password')} aria-label={t('password')}
                id={mode === 'in' ? 'current-password' : 'new-password'} name="password"
                value={f.password} onChange={e => { setPwIssue(null); set('password')(e) }} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
              <button type="button" aria-label="show password" onClick={() => setShow(!show)} className="absolute inset-y-0 end-0 grid w-12 place-items-center text-2">
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {mode === 'up' && <div className="-mt-1"><PasswordMeter value={f.password} issue={pwIssue} /></div>}
            {mode === 'up' && (
              <>
                <p className="label !mb-0 pt-1">{t('address')}</p>
                <CitySelect required withIcon value={f.city} onChange={city => setF({ ...f, city })} />
                {f.city && (
                  <div className="relative">
                    <Home className="pointer-events-none absolute start-4 top-4 size-5 text-2" />
                    <textarea required rows={2} className="field resize-none ps-12" placeholder={t('fullAddress')} aria-label={t('fullAddress')}
                      value={f.address} onChange={set('address')} autoComplete="street-address" />
                  </div>
                )}
              </>
            )}
            <button disabled={busy} className="btn btn-primary mt-1 min-h-14 w-full text-base">
              {busy && <Spinner />} {mode === 'in' ? t('signIn') : t('signUp')}
            </button>
            {mode === 'in' && <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-2"><ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />{t('staySignedIn')}</p>}
            {mode === 'in' && <button type="button" disabled={busy} onClick={forgot} className="min-h-11 w-full text-center text-sm font-semibold text-2">{t('forgot')}</button>}
          </form>
        </div>
        {!isNativeApp && (
          <a href={ANDROID_APK_URL} className="btn mt-4 min-h-12 w-full border border-theme surface text-sm">
            <Download className="size-5 text-s-green" />{t('getAndroidApp')}
          </a>
        )}
        <p className="mt-auto pt-6 text-center text-xs text-2">
          <span dir="ltr">Sanad Company © 2026</span> · <a href="./privacy.html" target="_blank" rel="noreferrer" className="underline">{t('privacy')}</a>
          <br /><span dir="ltr">Created by <a href="https://wa.me/9647508418593" target="_blank" rel="noreferrer" className="font-extrabold text-[#25D366]">Saman</a></span>
        </p>
      </div>
    </div>
  )
}
