import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquareText, Star } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { StarInput } from './Stars'
import { Spinner } from './ui'
import { cn } from '../lib/format'
import type { OrderItem } from '../lib/types'

type Mine = { product_id: string; rating: number; comment: string | null }

const LABELS = ['rate1', 'rate1', 'rate2', 'rate3', 'rate4', 'rate5'] as const

function RateRow({ item, orderId, mine, onSaved }: { item: OrderItem; orderId: string; mine?: Mine; onSaved: (m: Mine) => void }) {
  const { t } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [showComment, setShowComment] = useState(!!mine?.comment)
  const [busy, setBusy] = useState(false)
  const dirty = rating > 0 && (rating !== (mine?.rating ?? 0) || comment.trim() !== (mine?.comment ?? ''))

  async function save() {
    if (!session || !item.product_id || !rating) return
    setBusy(true)
    const row = { product_id: item.product_id, user_id: session.user.id, order_id: orderId, rating, comment: comment.trim() || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('product_reviews').upsert(row, { onConflict: 'product_id,user_id' })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(t('thanksForRating'))
    onSaved({ product_id: item.product_id, rating, comment: row.comment })
  }

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{item.product_name}</p>
          {item.size && <p className="text-xs text-2" dir="ltr">{item.size}</p>}
        </div>
        {mine && !dirty && <span className="chip shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-3.5" />{t('rated')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3">
        <StarInput value={rating} onChange={setRating} label={item.product_name} disabled={busy} />
        {rating > 0 && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{t(LABELS[rating])}</span>}
      </div>
      {rating > 0 && (showComment
        ? <textarea rows={2} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} placeholder={t('reviewPlaceholder')} className="field resize-none text-sm" />
        : <button type="button" onClick={() => setShowComment(true)} className="flex min-h-10 items-center gap-1.5 text-xs font-bold text-brand"><MessageSquareText className="size-4" />{t('addComment')}</button>)}
      {dirty && (
        <button onClick={save} disabled={busy} className="btn btn-primary min-h-11 px-5 text-sm">{busy ? <Spinner /> : <Star className="size-4" />}{mine ? t('updateRating') : t('submitRating')}</button>
      )}
    </li>
  )
}

/** Shown on a delivered order (to its owner): rate each product 1–5 stars, optional comment. */
export default function RateOrder({ orderId, items }: { orderId: string; items: OrderItem[] }) {
  const { t } = usePrefs()
  const { session } = useAuth()
  const [mine, setMine] = useState<Record<string, Mine> | null>(null)
  // one row per product (the same product can appear twice in an order)
  const products = useMemo(() => items.filter((i, n) => i.product_id && items.findIndex(x => x.product_id === i.product_id) === n), [items])

  useEffect(() => {
    if (!session || !products.length) return
    supabase.from('product_reviews').select('product_id, rating, comment').eq('user_id', session.user.id).in('product_id', products.map(p => p.product_id!))
      .then(({ data }) => setMine(Object.fromEntries(((data as Mine[]) ?? []).map(m => [m.product_id, m]))))
  }, [session, products])

  if (!products.length || !mine) return null
  const done = products.filter(p => mine[p.product_id!]).length
  return (
    <section id="rate" className="card no-print overflow-hidden">
      <div className="flex items-center gap-3 border-b border-theme p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-400 text-white shadow-md shadow-amber-400/30"><Star className="size-6" fill="currentColor" strokeWidth={0} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{t('rateYourOrder')}</p>
          <p className="text-xs text-2">{t('rateYourOrderHint')}</p>
        </div>
        <span className={cn('chip shrink-0', done === products.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'surface-2')} dir="ltr">{done}/{products.length}</span>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {products.map(i => (
          <RateRow key={i.product_id} item={i} orderId={orderId} mine={mine[i.product_id!]} onSaved={m => setMine(s => ({ ...s, [m.product_id]: m }))} />
        ))}
      </ul>
    </section>
  )
}
