import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, PackageSearch, Search, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useCategories, useProducts } from '../lib/data'
import { supabase } from '../lib/supabase'
import { BrandLogo, EmptyState, ErrorBox, Skeleton, StatusBadge } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { assetUrl, money } from '../lib/format'
import type { Order, Product } from '../lib/types'

export default function Home() {
  const { t, catName, dir, lang } = usePrefs()
  const { profile, session } = useAuth()
  const { categories, error, reload } = useCategories()
  const { products } = useProducts()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Product | null>(null)
  const [recent, setRecent] = useState<Order[] | null>(null)
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight

  useEffect(() => {
    if (!session) return
    supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setRecent((data as Order[]) ?? []))
  }, [session])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    products?.forEach(p => { m[p.category_id] = (m[p.category_id] || 0) + 1 })
    return m
  }, [products])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s || !products) return null
    return products.filter(p => [p.name, p.sku, p.size, p.description].some(v => v?.toLowerCase().includes(s)))
  }, [q, products])

  const accentOf = (id: string) => categories?.find(c => c.id === id)?.accent
  const hour = new Date().getHours()
  const name = profile?.full_name?.split(' ')[0]

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink px-5 pb-20 pt-[calc(env(safe-area-inset-top)+20px)] text-white">
        <div className="pointer-events-none absolute -end-24 -top-24 size-72 rotate-45 rounded-[60px] opacity-25 blur-xl sanad-stripe" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-white p-1.5 shadow-lg">
            <img src={assetUrl('brands/sanad-mark.png')} alt="" className="size-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/60">{hour < 12 ? t('goodMorning') : t('goodEvening')} 👋</p>
            <h1 className="truncate text-xl font-extrabold">{name || t('welcome')}</h1>
          </div>
          <span className="chip bg-white/10 text-white/80">Sanad Order</span>
        </div>
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-2xl border-0 bg-white py-4 ps-12 pe-12 text-ink shadow-xl outline-none placeholder:text-gray-400"
          />
          {q && <button aria-label="clear" onClick={() => setQ('')} className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-gray-100 text-gray-500"><X className="size-4" /></button>}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1.5 sanad-stripe" />
      </section>

      <div className="relative -mt-12 px-4">
        {error && <ErrorBox message={error} onRetry={reload} />}

        {results ? (
          <section className="card p-4">
            <p className="mb-3 text-sm font-bold text-2">{results.length} {t('products')}</p>
            {results.length === 0
              ? <EmptyState icon={<PackageSearch className="size-9" />} title={t('noResults')} />
              : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((p, i) => <ProductCard key={p.id} index={i} product={p} accent={accentOf(p.category_id)} onOpen={() => setOpen(p)} />)}
                </div>}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3">
              {!categories && [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-[28px]" />)}
              {categories?.map((c, i) => (
                <Link key={c.id} to={`/c/${c.slug}`} className="rise group card relative flex h-48 flex-col overflow-hidden p-0 transition active:scale-[.98]" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex min-h-0 flex-1 bg-white p-3"><BrandLogo category={c} className="min-h-0 flex-1 !bg-transparent transition duration-500 group-hover:scale-105" /></div>
                  <div className="flex items-center gap-2 border-t border-theme px-3 py-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{catName(c)}</p>
                      <p className="text-[11px] font-semibold text-2">{counts[c.id] ?? 0} {t('products')}</p>
                    </div>
                    <Chevron className="size-4 text-2 transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.accent }} />
                </Link>
              ))}
            </section>

            {recent && recent.length > 0 && (
              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">{t('recentOrders')}</h2>
                  <Link to="/orders" className="text-sm font-bold text-brand">{t('seeAll')}</Link>
                </div>
                <div className="card divide-y divide-[var(--border)]">
                  {recent.map(o => (
                    <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-3 p-4">
                      <div className="grid size-11 place-items-center rounded-2xl surface-2 text-sm font-black" dir="ltr">#{o.order_no}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" dir="ltr">{money(o.total, lang)}</p>
                        <p className="text-xs text-2">{o.items_count} {t('items')}</p>
                      </div>
                      <StatusBadge status={o.status} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <ProductSheet product={open} accent={open ? accentOf(open.category_id) : undefined} onClose={() => setOpen(null)} />
    </div>
  )
}
