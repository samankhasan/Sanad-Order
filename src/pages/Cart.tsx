import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ImageOff, Lock, MapPin, Plus, Send, ShoppingBag, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AddressForm from '../components/address/AddressForm'
import { AddressIcon, AddressSummary } from '../components/address/AddressCard'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useAddresses, useCategories, usePaymentMethods } from '../lib/data'
import PaymentLogo, { paymentName } from '../components/PaymentLogo'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/push'
import { EmptyState, PageHeader, QtyStepper, Sheet, Spinner, Thumb } from '../components/ui'
import { cn, money } from '../lib/format'
import type { Order } from '../lib/types'

export default function Cart() {
  const { t, lang, catName } = usePrefs()
  const cart = useCart()
  const toast = useToast()
  const nav = useNavigate()
  const { categories } = useCategories()
  const [note, setNote] = useState('')
  const { methods } = usePaymentMethods()
  const [payment, setPayment] = useState('cash')
  const { session } = useAuth()
  const { addresses, reload: reloadAddresses } = useAddresses(session?.user.id)
  const [addressId, setAddressId] = useState<string | null>(null)
  const [addingAddress, setAddingAddress] = useState(false)
  // pick the default (or newest) saved location automatically
  const selectedAddress = addresses?.find(a => a.id === addressId) ?? addresses?.[0] ?? null
  const [busy, setBusy] = useState(false)

  async function place() {
    if (!selectedAddress) { setAddingAddress(true); return }
    setBusy(true)
    const items = cart.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity }))
    const { data, error } = await supabase.rpc('place_order', { p_items: items, p_note: note, p_payment: payment, p_address: selectedAddress.id })
    setBusy(false)
    if (error) { toast(/account_blocked/.test(error.message) ? t('accountBlocked') : /payment_unavailable/.test(error.message) ? t('paymentUnavailable') : /address_not_found/.test(error.message) ? t('addDeliveryLocation') : error.message, 'error'); return }
    cart.clear()
    notify({ action: 'new_order', order_id: (data as Order).id })
    toast(t('orderPlaced'))
    nav(`/orders/${(data as Order).id}`, { replace: true })
  }

  if (cart.lines.length === 0) {
    return (
      <>
        <PageHeader title={t('cart')} />
        <EmptyState icon={<ShoppingBag className="size-9" />} title={t('cartEmpty')} hint={t('cartEmptyHint')} action={<Link to="/" className="btn btn-primary">{t('browse')}</Link>} />
      </>
    )
  }

  // group lines by brand
  const groups = (categories ?? []).map(c => ({ c, lines: cart.lines.filter(l => l.product.category_id === c.id) })).filter(g => g.lines.length)
  const orphan = cart.lines.filter(l => !categories?.some(c => c.id === l.product.category_id))

  return (
    <div>
      <PageHeader title={t('cart')} subtitle={`${cart.count} ${t('items')}`}
        right={<button onClick={() => cart.clear()} className="chip min-h-10 surface-2 px-3 text-2"><Trash2 className="size-4" />{t('clearCart')}</button>} />
      <div className="page-narrow px-g space-y-4 pb-48">
        {[...groups, ...(orphan.length ? [{ c: null, lines: orphan }] : [])].map(({ c, lines }) => (
          <section key={c?.id ?? 'x'} className="card overflow-hidden">
            {c && <div className="flex items-center gap-2 border-b border-theme px-4 py-3"><span className="size-2.5 rounded-full" style={{ background: c.accent }} /><h2 className="text-sm font-extrabold">{catName(c)}</h2></div>}
            <ul className="divide-y divide-[var(--border)]">
              {lines.map(({ product: p, quantity }) => (
                <li key={p.id} className="flex gap-3 p-3">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
                    {p.image_url ? <Thumb src={p.image_url} className="size-full object-contain p-1" /> : <ImageOff className="size-6 text-gray-300" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 flex-1 text-sm font-bold">{p.name}</p>
                      <button aria-label="remove" onClick={() => cart.remove(p.id)} className="-m-2 grid size-10 place-items-center text-2"><Trash2 className="size-4" /></button>
                    </div>
                    {p.size && <p className="text-xs text-2">{p.size}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <QtyStepper size="sm" value={quantity} onChange={v => cart.setQty(p.id, v)} />
                      <span className="text-sm font-extrabold" dir="ltr">{money(p.price * quantity, lang)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {/* delivery location */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="label !mb-0 flex items-center gap-1.5"><MapPin className="size-3.5" />{t('deliveryLocation')}</p>
            {!!addresses?.length && <button type="button" onClick={() => setAddingAddress(true)} className="flex min-h-10 items-center gap-1 text-xs font-bold text-brand"><Plus className="size-4" />{t('newAddress')}</button>}
          </div>
          {addresses && addresses.length === 0 && (
            <button type="button" onClick={() => setAddingAddress(true)} className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-brand)] p-3 text-start text-brand">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)]"><MapPin className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{t('addDeliveryLocation')}</span><span className="block text-xs text-2">{t('addDeliveryLocationHint')}</span></span>
              <Plus className="size-5" />
            </button>
          )}
          <div role="radiogroup" aria-label={t('deliveryLocation')} className="space-y-2">
            {addresses?.map(a => {
              const on = selectedAddress?.id === a.id
              return (
                <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setAddressId(a.id)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start transition', on ? 'border-[var(--color-brand)] bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)]' : 'border-theme')}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl surface-2"><AddressIcon label={a.label} className="size-5" /></span>
                  <AddressSummary a={a} />
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-theme')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* payment method: cash is live; the others show their logo and "coming soon" until enabled */}
        <section className="card p-4">
          <p className="label flex items-center gap-1.5"><Lock className="size-3.5" />{t('paymentMethod')}</p>
          <div role="radiogroup" aria-label={t('paymentMethod')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(methods ?? []).map(m => {
              const on = payment === m.code
              return (
                <button key={m.code} type="button" role="radio" aria-checked={on} disabled={!m.is_enabled} onClick={() => setPayment(m.code)}
                  className={cn('relative flex min-h-[64px] items-center gap-3 rounded-2xl border-2 p-3 text-start transition',
                    on ? 'border-[var(--color-brand)] bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)]' : 'border-theme',
                    !m.is_enabled && 'cursor-not-allowed opacity-60')}>
                  <PaymentLogo method={m} className="size-11 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold leading-snug">{paymentName(m, lang)}</span>
                    <span className="block text-[11px] font-semibold text-2">{m.is_enabled ? (m.code === 'cash' ? t('payCashHint') : t('payOnlineHint')) : t('ch_upcoming')}</span>
                  </span>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-theme')}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card p-4">
          <label className="label">{t('note')}</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t('notePlaceholder')} className="field resize-none" />
        </section>
      </div>

      <div className="fab-bar no-print">
        <div className="mx-auto max-w-md rounded-[26px] border border-theme surface p-3 shadow-2xl">
          <div className="flex items-center justify-between px-2 pb-3">
            <span className="text-sm font-semibold text-2">{t('total')}</span>
            <span className="text-xl font-black" dir="ltr">{money(cart.total, lang)}</span>
          </div>
          <button disabled={busy || !addresses} onClick={place} className="btn btn-primary w-full py-4 text-base">
            {busy ? <Spinner /> : <Send className="size-5 rtl:-scale-x-100" />} {t('placeOrder')}
          </button>
        </div>
      </div>
      <Sheet open={addingAddress} onClose={() => setAddingAddress(false)}>
        {addingAddress && <AddressForm onClose={() => setAddingAddress(false)} onSaved={a => { setAddressId(a.id); reloadAddresses() }} />}
      </Sheet>
    </div>
  )
}
