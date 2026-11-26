import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImageOff, Send, ShoppingBag, Trash2 } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../lib/data'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/push'
import { EmptyState, PageHeader, QtyStepper, Spinner, Thumb } from '../components/ui'
import { money } from '../lib/format'
import type { Order } from '../lib/types'

export default function Cart() {
  const { t, lang, catName } = usePrefs()
  const cart = useCart()
  const toast = useToast()
  const nav = useNavigate()
  const { categories } = useCategories()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function place() {
    setBusy(true)
    const items = cart.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity }))
    const { data, error } = await supabase.rpc('place_order', { p_items: items, p_note: note })
    setBusy(false)
    if (error) { toast(/account_blocked/.test(error.message) ? t('accountBlocked') : error.message, 'error'); return }
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
          <button disabled={busy} onClick={place} className="btn btn-primary w-full py-4 text-base">
            {busy ? <Spinner /> : <Send className="size-5 rtl:-scale-x-100" />} {t('placeOrder')}
          </button>
        </div>
      </div>
    </div>
  )
}
