import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'
import { assetUrl } from '../lib/format'

export default function SetPassword() {
  const { t } = usePrefs()
  const { endRecovery } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(t('passwordUpdated'))
    endRecovery()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-g pb-[var(--sab)] pt-[var(--sat)]">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <img src={assetUrl('brands/sanad-mark.png')} alt="" className="h-12" />
          <h1 className="text-xl font-extrabold">{t('setNewPassword')}</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
            <input required minLength={6} type={show ? 'text' : 'password'} dir="ltr" className="field px-12 text-start rtl:text-right"
              placeholder={`${t('newPassword')} — ${t('passwordHint')}`} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" autoFocus />
            <button type="button" aria-label="show password" onClick={() => setShow(!show)} className="absolute inset-y-0 end-0 grid w-12 place-items-center text-2">
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <button disabled={busy} className="btn btn-primary min-h-14 w-full">{busy && <Spinner />}{t('save')}</button>
        </form>
      </div>
    </div>
  )
}
