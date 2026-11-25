import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PackageOpen, Search, ShoppingBag, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useCategories, useProducts } from '../lib/data'
import { BackButton, BrandLogo, EmptyState, ErrorBox, PullToRefresh, Skeleton } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { money } from '../lib/format'
import type { Product } from '../lib/types'
import { setStatusBarOverride } from '../lib/native'

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
  useEffect(() => { setStatusBarOverride('dark'); return () => setStatusBarOverride(null) }, [])
  const refresh = useCallback(() => reload(), [reload])

  const list = useMemo(() => {
    if (!products) return null
    const s = q.trim().toLowerCase()
    const l = s ? products.filter(p => [p.name, p.sku, p.size].some(v => v?.toLowerCase().includes(s))) : [...products]
    if (sort === 'price_asc') l.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') l.sort((a, b) => b.price - a.price)
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name))
    return l
  }, [products, q, sort])

  const sorts: Sort[] = ['default', 'price_asc', 'price_desc', 'name']
  const sortLabel: Record<Sort, string> = { default: t('all'), price_asc: `${t('price')} ↑`, price_desc: `${t('price')} ↓`, name: 'A–Z' }
  const accent = cat?.accent ?? '#0b1220'

  return (
    <PullToRefresh onRefresh={refresh}>
      {/* brand header (always white so every logo shows in its real colours) */}
      <header className="relative bg-white text-ink pt-[var(--sat)]">
        <div className="absolute inset-x-0 top-0 h-[calc(var(--sat)+6px)]" style={{ background: accent }} />
        <div className="page px-g relative flex min-h-[64px] items-center pt-1.5">
          <BackButton to="/" />
          <div className="flex-1" />
          <Link to="/cart" aria-label={t('cart')} className="icon-btn relative -me-2">
            <ShoppingBag className="size-6" />
            {cart.count > 0 && <span className="absolute end-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-black text-white" style={{ background: accent }}>{cart.count}</span>}
          </Link>
        </div>
        <div className="page px-g pb-6">
          {cat ? <BrandLogo category={cat} className="mx-auto h-24 w-full max-w-[280px] sm:h-28" /> : <Skeleton className="mx-auto h-24 max-w-[280px]" />}
        </div>
      </header>

      {/* sticky title, search and sort */}
      <div className="app-bar !border-theme border-b" data-scrolled="true">
        <div className="page px-g pb-3 pt-2">
          <div className="flex min-h-10 items-center gap-2">
            <h1 className="truncate text-xl font-extrabold">{cat ? catName(cat) : '…'}</h1>
            <span className="chip surface-2 text-2">{products?.length ?? 0}</span>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
            <input type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12 pe-12 [&::-webkit-search-cancel-button]:hidden" />
            {q && <button aria-label="clear" onClick={() => setQ('')} className="absolute end-1 top-1/2 grid size-12 -translate-y-1/2 place-items-center text-2"><X className="size-5" /></button>}
          </div>
          <div className="no-scrollbar -mx-[var(--gutter)] mt-3 flex gap-2 overflow-x-auto px-[var(--gutter)]">
            {sorts.map(s => (
              <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)} className="filter-chip" style={sort === s ? { background: accent, color: '#fff' } : undefined}>
                {sortLabel[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page px-g pt-4">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!list && <div className="grid-products">{[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-[20px]" />)}</div>}
        {list && list.length === 0 && (
          <EmptyState icon={<PackageOpen className="size-9" />} title={q ? t('noResults') : t('noProducts')} hint={q ? undefined : t('noProductsHint')} />
        )}
        {list && list.length > 0 && (
          <div className="grid-products">
            {list.map((p, i) => <ProductCard key={p.id} index={i} product={p} accent={accent} onOpen={() => setOpen(p)} />)}
          </div>
        )}
        {cart.count > 0 && <div className="h-20" />}
      </div>

      {cart.count > 0 && (
        <div className="fab-bar no-print">
          <Link to="/cart" className="rise mx-auto flex min-h-14 max-w-md items-center gap-3 rounded-2xl px-5 font-bold text-white shadow-2xl active:scale-[.98] transition" style={{ background: accent }}>
            <ShoppingBag className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t('cart')} · {cart.count} {t('items')}</span>
            <span dir="ltr" className="shrink-0">{money(cart.total, lang)}</span>
          </Link>
        </div>
      )}
      <ProductSheet product={open} accent={accent} onClose={() => setOpen(null)} />
    </PullToRefresh>
  )
}
