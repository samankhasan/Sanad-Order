import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellPlus, BellRing, PackageX } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { enablePush, isNative, pushState } from '../lib/push'
import { haptic } from '../lib/native'
import { Spinner } from './ui'

/** Out of stock → "Notify me when it's back". Tapping again cancels. The member gets an in-app + push notification
 *  the moment staff mark the product in stock again. */
export default function StockAlertButton({ productId }: { productId: string }) {
  const { t } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const uid = session?.user.id

  useEffect(() => {
    if (!uid) return
    supabase.from('stock_alerts').select('notified_at').eq('user_id', uid).eq('product_id', productId).maybeSingle()
      .then(({ data }) => setOn(!!data && !data.notified_at))
  }, [uid, productId])

  async function toggle() {
    if (!uid) return
    setBusy(true)
    // an old, already-sent alert is replaced by a fresh one
    await supabase.from('stock_alerts').delete().eq('user_id', uid).eq('product_id', productId)
    if (!on) {
      const { error } = await supabase.from('stock_alerts').insert({ user_id: uid, product_id: productId })
      setBusy(false)
      if (error) { toast(error.message, 'error'); return }
      haptic('success'); setOn(true); toast(t('stockAlertOn'))
      // best moment to ask for notification permission: the member just asked to be told
      if (!isNative && pushState() === 'default') enablePush(p => nav(p)).catch(() => {})
    } else {
      setBusy(false); setOn(false); toast(t('stockAlertOff'))
    }
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-rose-600 dark:text-rose-400"><PackageX className="size-4" />{t('outOfStock')}</p>
      <button onClick={toggle} disabled={busy || on === null}
        className={on
          ? 'btn min-h-14 w-full border-2 border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'btn btn-primary min-h-14 w-full'}>
        {busy ? <Spinner /> : on ? <BellRing className="size-5" /> : <BellPlus className="size-5" />}
        <span className="truncate">{on ? t('stockAlertActive') : t('notifyWhenBack')}</span>
      </button>
      {on && <p className="text-center text-xs text-2">{t('stockAlertHint')}</p>}
    </div>
  )
}
