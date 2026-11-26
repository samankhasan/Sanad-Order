import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtSign, Check, MapPin, MessageCircle, Phone, Printer, RotateCcw, XCircle } from 'lucide-react'
import { placeLabel } from '../lib/iraq'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/push'
import { ErrorBox, PageHeader, Skeleton, Spinner, StatusBadge } from '../components/ui'
import { assetUrl, cn, dateTime, money } from '../lib/format'
import { SUPPORT_PHONES } from '../lib/contact'
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
      supabase.from('orders').select('*, profiles(full_name, phone, shop_name, city, address, username)').eq('id', id!).single(),
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
    if (error) toast(error.message, 'error'); else { toast(t('saved')); load(); notify({ action: 'order_status', order_id: id }) }
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
      order.profiles?.full_name || order.profiles?.shop_name || '',
      [placeLabel(order.profiles?.city, lang), order.profiles?.address].filter(Boolean).join(' — '),
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
    <div>
      <PageHeader back title={<span dir="ltr">{t('order')} #{order.order_no}</span>} subtitle={dateTime(order.created_at, lang)}
        right={<button aria-label={t('print')} onClick={() => window.print()} className="icon-btn -me-2"><Printer className="size-5" /></button>} />

      <div className="page-narrow px-g space-y-4 pb-4">
        {/* printed invoice header */}
        <div className="hidden print:block">
          <div className="flex items-center justify-between gap-6 border-b-2 border-black pb-4">
            <div className="flex items-center gap-4">
              <img src={assetUrl('brands/sanad.png')} alt="Sanad Company" className="h-24 w-auto" />
              <div>
                <p className="text-2xl font-black">Sanad Company</p>
                <p className="text-sm">کۆمپانیای ساناد · شركة ساناد</p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-xl font-black">{t('invoice')}</p>
              <p className="text-lg font-bold" dir="ltr">#{order.order_no}</p>
              <p className="text-sm">{t('date')}: {dateTime(order.created_at, lang)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <p><b>{t('customer')}:</b> {order.profiles?.full_name || '—'}</p>
            {order.profiles?.phone && <p dir="ltr"><b>{t('phone')}:</b> +{order.profiles.phone}</p>}
            {(order.profiles?.city || order.profiles?.address) && <p><b>{t('address')}:</b> {[placeLabel(order.profiles?.city, lang), order.profiles?.address].filter(Boolean).join(' — ')}</p>}
          </div>
          <div className="mt-3 h-1.5 sanad-stripe [print-color-adjust:exact] [-webkit-print-color-adjust:exact]" />
        </div>
        {/* status timeline */}
        <section className="card no-print p-5">
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
          <section className="card no-print p-4">
            <p className="label">{t('customer')}</p>
            <p className="text-lg font-extrabold">{order.profiles.full_name || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {order.profiles.username && <span className="chip surface-2" dir="ltr"><AtSign className="size-3.5" />{order.profiles.username}</span>}
              {order.profiles.phone && <a href={`tel:+${order.profiles.phone}`} className="chip min-h-9 surface-2" dir="ltr"><Phone className="size-3.5" />+{order.profiles.phone}</a>}
            </div>
            {(order.profiles.city || order.profiles.address) && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl surface-2 p-3 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-2" />
                <span><b>{placeLabel(order.profiles.city, lang)}</b>{order.profiles.address && ` — ${order.profiles.address}`}</span></p>
            )}
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

        {/* printed invoice: faint logo watermark behind the page + contact note as the page footer (repeats on every page) */}
        <img src={assetUrl('brands/sanad-mark.png')} alt="" aria-hidden="true" className="invoice-watermark hidden print:block" />
        <footer className="invoice-footer hidden print:flex">
          <b>{t('invoiceNoteTitle')}:</b>
          <span>{t('invoiceNote')}</span>
          {SUPPORT_PHONES.map((p, i) => (
            <span key={p.e164} className="contents">
              {i > 0 && <span aria-hidden="true">·</span>}
              <bdi className="font-bold" dir="ltr">{`\u2066${p.display}\u2069`}</bdi>
            </span>
          ))}
        </footer>

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
