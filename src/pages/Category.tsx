import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownWideNarrow, PackageOpen, Search, ShoppingBag } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useCategories, useProducts } from '../lib/data'
import { BackButton, BrandLogo, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { cn, money } from '../lib/format'
import type { Product } from '../lib/types'

type Sort = 'default' | 'price_asc' | 'price_desc' | 'name'

export default function Category() {
  const { slug } = useParams()
  const { t, catName, lang } = usePrefs()
  const cart = useCart()
  const { categories } = useCategories()
  const cat = categories?.find(c => c.slug === slug)
  const { products, error, reload } = useProducts(cat?.id ?? '00000000-0000-0000-0000-000000000000')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('default')
  const [open, setOpen] = useState<Product | null>(null)
  useEffect(() => { setOpen(null); setQ('') }, [slug])

  const list = useMemo(() => {
    if (!products) return null
    const s = q.trim().toLowerCase()
    let l = s ? products.filter(p => [p.name, p.sku, p.size].some(v => v?.toLowerCase().includes(s))) : [...products]
    if (sort === 'price_asc') l.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') l.sort((a, b) => b.price - a.price)
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name))
    return l
  }, [products, q, sort])

  const sorts: Sort[] = ['default', 'price_asc', 'price_desc', 'name']
  const sortLabel: Record<Sort, string> = { default: t('all'), price_asc: `${t('price')} ↑`, price_desc: `${t('price')} ↓`, name: 'A–Z' }
  const accent = cat?.accent ?? '#0b1220'

  return (
    <div className="mx-auto max-w-3xl">
      <header className="relative overflow-hidden bg-white text-ink safe-top">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
        <div className="flex items-center gap-3 px-4 pt-4">
          <BackButton to="/" />
          <div className="flex-1" />
          <Link to="/cart" className="relative grid size-11 place-items-center rounded-2xl border border-gray-200 bg-white">
            <ShoppingBag className="size-5" />
            {cart.count > 0 && <span className="absolute -top-1 -end-1 grid min-w-5 place-items-center rounded-full px-1 text-[10px] font-black text-white" style={{ background: accent }}>{cart.count}</span>}
          </Link>
        </div>
        <div className="px-8 pb-6 pt-2">
          {cat ? <BrandLogo category={cat} className="mx-auto h-28 w-full max-w-xs" /> : <Skeleton className="mx-auto h-28 max-w-xs" />}
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-theme bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold">{cat ? catName(cat) : '…'}</h1>
          <span className="chip surface-2 text-2">{products?.length ?? 0}</span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12" />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <ArrowDownWideNarrow className="size-5 shrink-0 self-center text-2" />
          {sorts.map(s => (
            <button key={s} onClick={() => setSort(s)} className={cn('chip shrink-0 border py-1.5 text-xs transition', sort === s ? 'border-transparent text-white' : 'border-theme surface text-2')} style={sort === s ? { background: accent } : undefined}>
              {sortLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!list && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}</div>}
        {list && list.length === 0 && (
          <EmptyState icon={<PackageOpen className="size-9" />} title={q ? t('noResults') : t('noProducts')} hint={q ? undefined : t('noProductsHint')} />
        )}
        {list && list.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((p, i) => <ProductCard key={p.id} index={i} product={p} accent={accent} onOpen={() => setOpen(p)} />)}
          </div>
        )}
      </div>

      {cart.count > 0 && (
        <div className="no-print fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] z-30 px-4">
          <Link to="/cart" className="rise mx-auto flex max-w-md items-center gap-3 rounded-2xl px-5 py-3.5 font-bold text-white shadow-2xl" style={{ background: accent }}>
            <ShoppingBag className="size-5" />
            <span className="flex-1">{t('cart')} · {cart.count} {t('items')}</span>
            <span dir="ltr">{money(cart.total, lang)}</span>
          </Link>
        </div>
      )}
      <ProductSheet product={open} accent={accent} onClose={() => setOpen(null)} />
    </div>
  )
}
