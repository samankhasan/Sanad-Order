import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownWideNarrow, PackageOpen, Search, ShoppingBag, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useCategories, useProducts, useSubcategories } from '../lib/data'
import { BackButton, BrandLogo, EmptyState, ErrorBox, PullToRefresh, Skeleton } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { money, subName } from '../lib/format'
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
  const [subId, setSubId] = useState<string | null>(null)
  const { subcategories } = useSubcategories(cat?.id ?? '00000000-0000-0000-0000-000000000000')
  const [open, setOpen] = useState<Product | null>(null)
  useEffect(() => { setOpen(null); setQ(''); setSubId(null) }, [slug])
  useEffect(() => { setStatusBarOverride('dark'); return () => setStatusBarOverride(null) }, [])
  const refresh = useCallback(() => reload(), [reload])

  const list = useMemo(() => {
    if (!products) return null
    const s = q.trim().toLowerCase()
    let l = subId ? products.filter(p => p.subcategory_id === subId) : [...products]
    if (s) l = l.filter(p => [p.name, p.sku, p.size].some(v => v?.toLowerCase().includes(s)))
    if (sort === 'price_asc') l.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') l.sort((a, b) => b.price - a.price)
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name))
    return l
  }, [products, q, sort, subId])

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
          <div className="relative mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
            <input type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12 pe-12 [&::-webkit-search-cancel-button]:hidden" />
            {q && <button aria-label="clear" onClick={() => setQ('')} className="absolute end-1 top-1/2 grid size-12 -translate-y-1/2 place-items-center text-2"><X className="size-5" /></button>}
            </div>
            <label className="relative grid size-[52px] shrink-0 place-items-center rounded-[14px] border-[1.5px] border-theme surface-2" aria-label={t('sortBy')}>
              <ArrowDownWideNarrow className="size-5" style={sort !== 'default' ? { color: accent } : undefined} />
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t('sortBy')}>
                {sorts.map(s => <option key={s} value={s}>{s === 'default' ? t('sortBy') : sortLabel[s]}</option>)}
              </select>
            </label>
          </div>
          {subcategories && subcategories.length > 0 && (
            <div className="no-scrollbar -mx-[var(--gutter)] mt-3 flex gap-2 overflow-x-auto px-[var(--gutter)]">
              {[null, ...subcategories].map(sc => {
                const on = subId === (sc?.id ?? null)
                const count = products?.filter(p => !sc || p.subcategory_id === sc.id).length ?? 0
                return (
                  <button key={sc?.id ?? 'all'} aria-pressed={on} onClick={() => setSubId(sc?.id ?? null)} className="filter-chip" style={on ? { background: accent, color: '#fff' } : undefined}>
                    {sc ? subName(sc, lang) : t('all')}<span className="opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
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
