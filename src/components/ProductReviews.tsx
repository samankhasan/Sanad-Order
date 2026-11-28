import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, MessageSquareText, Pencil, Star, Trash2 } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { cn, dateTime } from '../lib/format'
import { Stars, StarInput } from './Stars'
import { Spinner } from './ui'
import type { ProductReview, RatingSummary } from '../lib/types'

const LABELS = ['rate1', 'rate1', 'rate2', 'rate3', 'rate4', 'rate5'] as const
const PREVIEW = 4

type Mine = { rating: number; comment: string | null }

/** The member's own rating: pick stars → optional comment → submit. Rating again updates it. */
function Composer({ productId, mine, focus, onSaved }: { productId: string; mine: Mine | null; focus?: boolean; onSaved: () => void }) {
  const { t } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(!mine)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => { setEditing(!mine); setRating(mine?.rating ?? 0); setComment(mine?.comment ?? '') }, [mine])
  useEffect(() => { if (focus) setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350) }, [focus])

  async function save() {
    if (!session || !rating) return
    setBusy('save')
    const { error } = await supabase.from('product_reviews').upsert(
      { product_id: productId, user_id: session.user.id, rating, comment: comment.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'product_id,user_id' }
    )
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    toast(t('thanksForRating'))
    onSaved()
  }
  async function remove() {
    if (!session || !confirm(t('deleteRatingConfirm'))) return
    setBusy('delete')
    const { error } = await supabase.from('product_reviews').delete().eq('product_id', productId).eq('user_id', session.user.id)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    toast(t('ratingDeleted'))
    onSaved()
  }

  if (!session) return null

  // already rated → compact summary with edit / delete
  if (mine && !editing) {
    return (
      <div ref={box} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/20">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-extrabold">{t('yourRating')}</p>
          <button onClick={() => setEditing(true)} className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-xs font-bold text-brand active:bg-black/5"><Pencil className="size-4" />{t('edit')}</button>
          <button onClick={remove} disabled={!!busy} aria-label={t('delete')} className="grid size-10 place-items-center rounded-xl text-rose-600 active:bg-black/5">
            {busy === 'delete' ? <Spinner /> : <Trash2 className="size-4" />}
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Stars value={mine.rating} size="size-5" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{t(LABELS[mine.rating])}</span>
        </div>
        {mine.comment && <p className="mt-2 whitespace-pre-line text-sm leading-6">{mine.comment}</p>}
      </div>
    )
  }

  const dirty = rating > 0 && (rating !== (mine?.rating ?? 0) || comment.trim() !== (mine?.comment ?? ''))
  return (
    <div ref={box} className={cn('space-y-3 rounded-2xl border border-theme p-4 transition', focus && !mine && 'ring-2 ring-amber-400/60')}>
      <div>
        <p className="font-extrabold">{mine ? t('yourRating') : t('rateThisProduct')}</p>
        {!mine && <p className="text-xs text-2">{t('rateThisProductHint')}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3">
        <StarInput value={rating} onChange={setRating} label={t('rateThisProduct')} disabled={!!busy} />
        {rating > 0 && <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{t(LABELS[rating])}</span>}
      </div>
      {rating > 0 && (
        <>
          <div className="relative">
            <MessageSquareText className="pointer-events-none absolute start-3 top-3 size-4 text-2" />
            <textarea rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} placeholder={t('reviewPlaceholder')} className="field resize-none ps-9 text-sm" />
            <span className="pointer-events-none absolute bottom-2 end-3 text-[10px] text-2" dir="ltr">{comment.length}/500</span>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!!busy || !dirty} className="btn btn-primary min-h-12 flex-1 text-sm">
              {busy === 'save' ? <Spinner /> : <Star className="size-4" fill="currentColor" strokeWidth={0} />}{mine ? t('updateRating') : t('submitRating')}
            </button>
            {mine && <button onClick={() => setEditing(false)} disabled={!!busy} className="btn btn-ghost min-h-12 px-4 text-sm">{t('cancel')}</button>}
          </div>
        </>
      )}
    </div>
  )
}

/** Product page ratings: average + star breakdown, the member's own rating, and other customers' reviews. */
export default function ProductReviews({ productId, focus }: { productId: string; focus?: boolean }) {
  const { t, lang } = usePrefs()
  const { session, isAdmin } = useAuth()
  const toast = useToast()
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [reviews, setReviews] = useState<ProductReview[] | null>(null)
  const [mine, setMine] = useState<Mine | null>(null)
  const [all, setAll] = useState(false)

  const load = useCallback(async () => {
    const [s, l, m] = await Promise.all([
      supabase.rpc('product_rating_summary', { p_product: productId }).single(),
      supabase.rpc('product_reviews_list', { p_product: productId, p_limit: 50 }),
      session
        ? supabase.from('product_reviews').select('rating, comment').eq('product_id', productId).eq('user_id', session.user.id).maybeSingle()
        : Promise.resolve({ data: null })
    ])
    setSummary((s.data as RatingSummary) ?? { avg: 0, total: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 })
    setReviews((l.data as ProductReview[]) ?? [])
    setMine((m.data as Mine) ?? null)
  }, [productId, session])
  useEffect(() => { setSummary(null); setReviews(null); setAll(false); load() }, [load])

  async function adminDelete(id: string) {
    if (!confirm(t('deleteRatingConfirm'))) return
    const { error } = await supabase.from('product_reviews').delete().eq('id', id)
    if (error) toast(error.message, 'error'); else { toast(t('ratingDeleted')); load() }
  }

  if (!summary || !reviews) {
    return <div className="h-40 animate-pulse rounded-2xl surface-2" />
  }

  const others = reviews.filter(r => !r.mine)
  const shown = all ? others : others.slice(0, PREVIEW)
  const avg = Number(summary.avg)

  return (
    <section id="reviews" className="space-y-4 border-t border-theme pt-5">
      <h3 className="text-lg font-extrabold">{t('customerRatings')}</h3>

      {/* summary: big average + 5→1 breakdown */}
      {summary.total > 0 ? (
        <div className="flex items-center gap-5 rounded-2xl surface-2 p-4">
          <div className="shrink-0 text-center">
            <p className="text-5xl font-black leading-none" dir="ltr">{avg.toFixed(1)}</p>
            <Stars value={avg} className="mt-2" size="size-4" />
            <p className="mt-1 text-[11px] font-semibold text-2"><bdi dir="ltr">{summary.total}</bdi> {t('ratings')}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map(n => {
              const c = summary[`s${n}`]
              return (
                <div key={n} className="flex items-center gap-2 text-[11px] font-bold" dir="ltr">
                  <span className="flex w-6 shrink-0 items-center gap-0.5 text-2">{n}<Star className="size-3 text-amber-400" fill="currentColor" strokeWidth={0} /></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <span className="block h-full rounded-full bg-amber-400 transition-[width] duration-500" style={{ width: `${summary.total ? (c / summary.total) * 100 : 0}%` }} />
                  </span>
                  <span className="w-6 shrink-0 text-end text-2">{c}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl surface-2 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-500"><Star className="size-6" fill="currentColor" strokeWidth={0} /></span>
          <div>
            <p className="font-extrabold">{t('noRatingsYet')}</p>
            <p className="text-xs text-2">{t('beFirstToRate')}</p>
          </div>
        </div>
      )}

      <Composer productId={productId} mine={mine} focus={focus} onSaved={load} />

      {/* other customers' reviews */}
      {shown.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {shown.map(r => (
            <li key={r.id} className="flex gap-3 py-3 first:pt-0">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full surface-2 text-sm font-black">
                {r.avatar_url ? <img src={r.avatar_url} alt="" loading="lazy" className="size-full object-cover" /> : r.reviewer.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="truncate text-sm">{r.reviewer}</b>
                  {r.verified && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><BadgeCheck className="size-3.5" />{t('verifiedPurchase')}</span>}
                  {isAdmin && <button onClick={() => adminDelete(r.id)} aria-label={t('delete')} className="ms-auto grid size-8 shrink-0 place-items-center rounded-lg text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-2">
                  <Stars value={r.rating} size="size-3" /><span>{dateTime(r.created_at, lang)}</span>
                </div>
                {r.comment && <p className="mt-1.5 whitespace-pre-line text-sm leading-6">{r.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {others.length > PREVIEW && (
        <button onClick={() => setAll(a => !a)} className="btn btn-ghost min-h-12 w-full text-sm">
          {all ? t('showFewerReviews') : <>{t('showAllReviews')} <bdi dir="ltr" className="text-2">({others.length})</bdi></>}
        </button>
      )}
    </section>
  )
}
