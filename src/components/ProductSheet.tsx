import { useEffect, useState } from 'react'
import { ImageOff, ShoppingBag } from 'lucide-react'
import { Stars } from './Stars'
import ProductReviews from './ProductReviews'
import { Sheet, QtyStepper } from './ui'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { money } from '../lib/format'
import type { Product } from '../lib/types'
import { haptic } from '../lib/native'

export default function ProductSheet({ product, accent, onClose, focusRating }: { product: Product | null; accent?: string; onClose: () => void; focusRating?: boolean }) {
  const { t, lang } = usePrefs()
  const cart = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  useEffect(() => { setQty(1) }, [product?.id])
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
        <ProductReviews productId={product.id} focus={focusRating} />
      </div>
    </Sheet>
  )
}
