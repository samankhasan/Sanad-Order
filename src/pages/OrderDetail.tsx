import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, MessageCircle, Phone, Printer, RotateCcw, Store, XCircle } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { ErrorBox, PageHeader, Skeleton, Spinner, StatusBadge } from '../components/ui'
import { cn, dateTime, money } from '../lib/format'
import { ORDER_FLOW, type Order, type OrderItem, type OrderStatus, type Product } from '../lib/types'

export default function OrderDetail() {
  const { id } = useParams()
  const { t, lang } = usePrefs()
  const { isAdmin, session } = useAuth()
  const cart = useCart()
  const toast = useToast()
  const nav = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [o, it] = await Promise.all([
      supabase.from('orders').select('*, profiles(full_name, phone, shop_name, city)').eq('id', id!).single(),
      supabase.from('order_items').select('*').eq('order_id', id!)
    ])
    if (o.error) { setError(o.error.message); return }
    setOrder(o.data as Order)
    setItems((it.data as OrderItem[]) ?? [])
  }, [id])

  useEffect(() => {
    load()
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  async function setStatus(s: OrderStatus) {
    setBusy(s)
    const { error } = await supabase.from('orders').update({ status: s }).eq('id', id!)
    setBusy(null)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); load() }
  }

  async function cancel() {
    if (!confirm(t('confirmCancel'))) return
    setBusy('cancel')
    const { error } = await supabase.rpc('cancel_my_order', { p_order: id })
    setBusy(null)
    if (error) toast(error.message, 'error'); else load()
  }

  async function reorder() {
    const ids = items?.map(i => i.product_id).filter(Boolean) as string[]
    const { data } = await supabase.from('products').select('*').in('id', ids).eq('is_active', true)
    ;(data as Product[] | null)?.forEach(p => {
      const q = items?.find(i => i.product_id === p.id)?.quantity ?? 1
      cart.add(p, q)
    })
    nav('/cart')
  }

  function whatsapp() {
    if (!order || !items) return
    const lines = [
      `*Sanad Order #${order.order_no}*`,
      order.profiles?.shop_name || order.profiles?.full_name || '',
      '',
      ...items.map(i => `• ${i.product_name}${i.size ? ` (${i.size})` : ''} × ${i.quantity} = ${money(i.line_total, lang)}`),
      '',
      `${t('total')}: ${money(order.total, lang)}`,
      order.note ? `📝 ${order.note}` : ''
    ].filter(l => l !== undefined)
    const phone = isAdmin ? (order.profiles?.phone || '').replace(/\D/g, '') : ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  if (error) return <><PageHeader title={t('order')} back /><ErrorBox message={error} onRetry={load} /></>
  if (!order) return <><PageHeader title={t('order')} back /><div className="space-y-3 p-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div></>

  const stepIndex = ORDER_FLOW.indexOf(order.status)
  const cancelled = order.status === 'cancelled'

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back title={<span dir="ltr">{t('order')} #{order.order_no}</span>} subtitle={dateTime(order.created_at, lang)}
        right={<button aria-label={t('print')} onClick={() => window.print()} className="no-print grid size-11 place-items-center rounded-2xl surface border border-theme"><Printer className="size-5" /></button>} />

      <div className="space-y-4 px-4 pb-8">
        {/* status timeline */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between"><StatusBadge status={order.status} /><span className="text-xs font-semibold text-2">{dateTime(order.updated_at, lang)}</span></div>
          {!cancelled ? (
            <ol className="flex items-start">
              {ORDER_FLOW.map((s, i) => (
                <li key={s} className="relative flex flex-1 flex-col items-center text-center">
                  {i > 0 && <span className={cn('absolute top-4 h-1 w-full', i <= stepIndex ? 'bg-emerald-500' : 'surface-2')} style={{ insetInlineEnd: '50%' }} />}
                  <span className={cn('relative z-10 grid size-9 place-items-center rounded-full border-4 border-[var(--surface)] text-white transition', i <= stepIndex ? 'bg-emerald-500' : 'surface-2 text-2')}>
                    {i <= stepIndex ? <Check className="size-4" strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </span>
                  <span className={cn('mt-1.5 text-[10px] font-bold leading-tight', i <= stepIndex ? '' : 'text-2')}>{t(`status_${s}` as const)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="flex items-center gap-2 text-sm font-bold text-rose-600"><XCircle className="size-5" />{t('status_cancelled')}</p>}
        </section>

        {/* customer (admin view) */}
        {isAdmin && order.profiles && (
          <section className="card p-4">
            <p className="label">{t('customer')}</p>
            <p className="text-lg font-extrabold">{order.profiles.full_name || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {order.profiles.shop_name && <span className="chip surface-2"><Store className="size-3.5" />{order.profiles.shop_name}</span>}
              {order.profiles.phone && <a href={`tel:${order.profiles.phone}`} className="chip surface-2" dir="ltr"><Phone className="size-3.5" />{order.profiles.phone}</a>}
            </div>
          </section>
        )}

        {/* items */}
        <section className="card overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {items?.map(i => (
              <li key={i.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl surface-2 text-sm font-black" dir="ltr">×{i.quantity}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{i.product_name}</p>
                  <p className="text-xs text-2" dir="ltr">{[i.size, money(i.unit_price, lang)].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-sm font-extrabold" dir="ltr">{money(i.line_total, lang)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-theme surface-2 px-4 py-4">
            <span className="font-bold">{t('total')}</span>
            <span className="text-xl font-black" dir="ltr">{money(order.total, lang)}</span>
          </div>
        </section>

        {order.note && <section className="card p-4"><p className="label">{t('note')}</p><p className="whitespace-pre-line text-sm">{order.note}</p></section>}

        {/* admin status control */}
        {isAdmin && (
          <section className="no-print card p-4">
            <p className="label">{t('changeStatus')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...ORDER_FLOW, 'cancelled' as const].map(s => (
                <button key={s} disabled={!!busy || order.status === s} onClick={() => setStatus(s)}
                  className={cn('btn py-3 text-sm', order.status === s ? 'btn-primary' : s === 'cancelled' ? 'btn-danger' : 'btn-ghost')}>
                  {busy === s && <Spinner className="size-4" />}{t(`status_${s}` as const)}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="no-print grid grid-cols-2 gap-2">
          <button onClick={whatsapp} className="btn bg-[#25D366] text-white"><MessageCircle className="size-5" />{t('shareWhatsapp')}</button>
          {order.user_id === session?.user.id && <button onClick={reorder} className="btn btn-ghost"><RotateCcw className="size-5" />{t('reorder')}</button>}
          {order.user_id === session?.user.id && order.status === 'pending' && (
            <button disabled={!!busy} onClick={cancel} className="btn btn-danger col-span-2">{busy === 'cancel' && <Spinner className="size-4" />}{t('cancelOrder')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
