import { useRef, useState } from 'react'
import { Camera, CreditCard, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { usePaymentMethods } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { PRESETS, uploadOptimized } from '../../lib/image'
import { Skeleton, Spinner } from '../../components/ui'
import PaymentLogo, { paymentName } from '../../components/PaymentLogo'
import { cn } from '../../lib/format'
import type { PaymentMethod } from '../../lib/types'

function MethodRow({ m, enabledCount, onSaved }: { m: PaymentMethod; enabledCount: number; onSaved: () => void }) {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'logo' | 'toggle' | null>(null)

  async function update(fields: Partial<PaymentMethod>, key: 'logo' | 'toggle') {
    setBusy(key)
    const { error } = await supabase.from('payment_methods').update({ ...fields, updated_at: new Date().toISOString() }).eq('code', m.code)
    setBusy(null)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); onSaved() }
  }
  async function upload(file: File) {
    setBusy('logo')
    try { const url = await uploadOptimized(file, 'payments', PRESETS.product); await update({ logo_url: url }, 'logo') }
    catch (e) { toast((e as Error).message, 'error'); setBusy(null) }
  }
  // never switch off the last available method: customers could not order
  const lockOff = m.is_enabled && enabledCount <= 1

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <PaymentLogo method={m} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug">{paymentName(m, lang)}</p>
          <span className={cn('chip mt-1', m.is_enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'surface-2 text-2')}>{m.is_enabled ? t('available') : t('ch_upcoming')}</span>
        </div>
        <label className={cn('relative inline-flex min-h-11 shrink-0 cursor-pointer items-center', lockOff && 'cursor-not-allowed opacity-50')} title={t('available')}>
          <input type="checkbox" className="peer sr-only" checked={m.is_enabled} disabled={!!busy || lockOff} onChange={e => update({ is_enabled: e.target.checked }, 'toggle')} />
          <span className="h-7 w-12 rounded-full bg-[var(--surface-3)] transition peer-checked:bg-emerald-500" />
          <span className="absolute start-1 top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
        </label>
      </div>
      <div className="flex items-center gap-1 border-t border-theme pt-2">
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-brand active:bg-[var(--surface-2)]">
          {busy === 'logo' ? <Spinner className="size-4" /> : <Camera className="size-4" />}{t('uploadLogo')}
        </button>
        {m.logo_url && <button onClick={() => update({ logo_url: null }, 'logo')} disabled={!!busy} aria-label={t('delete')} className="ms-auto grid size-11 place-items-center rounded-xl text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = '' }} />
    </li>
  )
}

/** Admin → Payments: which payment methods customers can choose, with each provider's logo. */
export default function AdminPayments() {
  const { t } = usePrefs()
  const { methods, reload } = usePaymentMethods()
  const enabled = methods?.filter(m => m.is_enabled).length ?? 0
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl surface-2 p-3 text-sm leading-7 text-2"><CreditCard className="mt-1 size-4 shrink-0" />{t('paymentSettingsHint')}</p>
      {!methods && <Skeleton className="h-64 rounded-3xl" />}
      {methods && <ul className="card divide-y divide-[var(--border)] overflow-hidden">{methods.map(m => <MethodRow key={m.code} m={m} enabledCount={enabled} onSaved={reload} />)}</ul>}
    </div>
  )
}
