import { useEffect, useState } from 'react'
import { ImageOff, ShoppingBag } from 'lucide-react'
import { Stars } from './Stars'
import { supabase } from '../lib/supabase'
import { dateTime } from '../lib/format'
import { Sheet, QtyStepper } from './ui'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { money } from '../lib/format'
import type { Product, ProductReview } from '../lib/types'
import { haptic } from '../lib/native'

export default function ProductSheet({ product, accent, onClose }: { product: Product | null; accent?: string; onClose: () => void }) {
  const { t, lang } = usePrefs()
  const cart = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  useEffect(() => { setQty(1) }, [product?.id])
  const [reviews, setReviews] = useState<ProductReview[] | null>(null)
  useEffect(() => {
    setReviews(null)
    if (!product?.id || !product.rating_count) return
    let live = true
    supabase.rpc('product_reviews_list', { p_product: product.id, p_limit: 20 }).then(({ data }) => { if (live) setReviews((data as ProductReview[]) ?? []) })
    return () => { live = false }
  }, [product?.id, product?.rating_count])
  if (!product) return null
  return (
    <Sheet open={!!product} onClose={onClose}>
      <div className="bg-white">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="mx-auto aspect-square max-h-[min(20rem,34dvh)] w-full object-contain p-6" />
          : <div className="grid h-[min(16rem,28dvh)] place-items-center text-gray-300"><ImageOff className="size-14" /></div>}
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight">{product.name}</h2>
          {!!product.rating_count && (
            <a href="#reviews" onClick={e => { e.preventDefault(); document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }) }} className="mt-1.5 inline-flex items-center gap-2 text-sm">
              <Stars value={Number(product.rating_avg)} size="size-4" />
              <b dir="ltr">{Number(product.rating_avg).toFixed(1)}</b>
              <span className="text-2">({product.rating_count} {t('ratings')})</span>
            </a>
          )}
          <p className="mt-2 text-2xl font-black" style={{ color: accent }} dir="ltr">
            {Number(product.price) > 0 ? money(product.price, lang) : t('priceOnRequest')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [t('size'), product.size || '—'],
            [t('unit'), t(`unit_${product.unit}` as never) || product.unit],
            [t('sku'), product.sku || '—']
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl surface-2 p-3">
              <p className="text-[11px] font-semibold text-2">{k}</p>
              <p className="mt-0.5 truncate text-sm font-bold">{v}</p>
            </div>
          ))}
        </div>
        {product.description && <p className="whitespace-pre-line text-sm leading-relaxed text-2">{product.description}</p>}
        {!!product.rating_count && (
          <section id="reviews" className="space-y-3 border-t border-theme pt-4">
            <div className="flex items-center gap-4 rounded-2xl surface-2 p-4">
              <div className="text-center">
                <p className="text-4xl font-black leading-none" dir="ltr">{Number(product.rating_avg).toFixed(1)}</p>
                <Stars value={Number(product.rating_avg)} className="mt-1.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{t('customerRatings')}</p>
                <p className="text-xs text-2">{product.rating_count} {t('ratings')}</p>
              </div>
            </div>
            {reviews?.filter(r => r.comment).map((r, i) => (
              <article key={i} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full surface-2 text-xs font-black">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="size-full object-cover" /> : r.reviewer.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs">
                    <b>{r.reviewer}</b><Stars value={r.rating} size="size-3" /><span className="text-2">{dateTime(r.created_at, lang)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6">{r.comment}</p>
                </div>
              </article>
            ))}
          </section>
        )}
        <div className="flex flex-col items-stretch gap-3 pt-2 xs:flex-row xs:items-center">
          <div className="flex justify-center"><QtyStepper value={qty} onChange={setQty} min={1} /></div>
          <button
            disabled={!product.in_stock}
            className="btn min-h-14 min-w-0 flex-1 px-3 text-white"
            style={{ background: accent || '#0b1220' }}
            onClick={() => { haptic('success'); cart.add(product, qty); toast(t('added')); onClose() }}
          >
            <ShoppingBag className="size-5 shrink-0" />
            <span className="truncate">{product.in_stock ? t('addToCart') : t('outOfStock')}</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}
