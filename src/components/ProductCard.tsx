import { Flame, ImageOff, Plus } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { money, cn } from '../lib/format'
import { Thumb } from './ui'
import { RatingBadge } from './Stars'
import type { Product } from '../lib/types'
import { haptic } from '../lib/native'

export default function ProductCard({ product, accent, onOpen, index = 0, rank }: { product: Product; accent?: string; onOpen: () => void; index?: number; /** best-seller position */ rank?: number }) {
  const { t, lang } = usePrefs()
  const cart = useCart()
  const qty = cart.qtyOf(product.id)
  return (
    <div className="rise card group flex min-w-0 flex-col overflow-hidden" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <button onClick={onOpen} className="relative aspect-square w-full overflow-hidden bg-white">
        {product.image_url
          ? <Thumb src={product.image_url} alt={product.name} className="size-full object-contain p-3 transition duration-500 group-hover:scale-105" />
          : <div className="grid size-full place-items-center text-gray-300"><ImageOff className="size-10" /></div>}
        {!product.in_stock && <span className="chip absolute top-2 start-2 bg-ink/85 text-white">{t('outOfStock')}</span>}
        {rank != null && product.in_stock && <span className="absolute top-2 start-2 flex items-center gap-0.5 rounded-full bg-s-red px-2 py-0.5 text-[11px] font-black text-white shadow" dir="ltr"><Flame className="size-3" />#{rank}</span>}
        {qty > 0 && <span key={qty} className="bump absolute top-2 end-2 grid min-w-7 place-items-center rounded-full px-2 py-1 text-xs font-black text-white" style={{ background: accent || '#0b1220' }}>{qty}</span>}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <button onClick={onOpen} className="text-start">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug">{product.name}</h3>
          {(product.size || product.unit) && (
            <p className="mt-0.5 text-xs text-2">{[product.size, t(`unit_${product.unit}` as never) || product.unit].filter(Boolean).join(' · ')}</p>
          )}
          <RatingBadge avg={product.rating_avg} count={product.rating_count} className="mt-1" />
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-sm font-extrabold" dir="ltr">{Number(product.price) > 0 ? money(product.price, lang) : <span className="text-xs font-semibold text-2">{t('priceOnRequest')}</span>}</span>
          <button
            aria-label={t('addToCart')}
            disabled={!product.in_stock}
            onClick={() => { haptic(); cart.add(product) }}
            className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-md transition active:scale-90 disabled:opacity-30')}
            style={{ background: accent || '#0b1220' }}
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
