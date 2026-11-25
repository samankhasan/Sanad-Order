import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, PackageSearch, Search, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useCategories, useProducts } from '../lib/data'
import { supabase } from '../lib/supabase'
import { BrandLogo, EmptyState, ErrorBox, PullToRefresh, Skeleton, StatusBadge } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { assetUrl, money } from '../lib/format'
import type { Order, Product } from '../lib/types'
import { setStatusBarOverride } from '../lib/native'

export default function Home() {
  const { t, catName, dir, lang } = usePrefs()
  const { profile, session } = useAuth()
  const { unread } = useNotifications()
  const { categories, error, reload } = useCategories()
  const { products, reload: reloadProducts } = useProducts()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Product | null>(null)
  const [recent, setRecent] = useState<Order[] | null>(null)
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight

  const loadRecent = useCallback(async () => {
    if (!session) return
    const { data } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(3)
    setRecent((data as Order[]) ?? [])
  }, [session])
  useEffect(() => { loadRecent() }, [loadRecent])
  useEffect(() => { setStatusBarOverride('light'); return () => setStatusBarOverride(null) }, [])
  const refresh = useCallback(() => Promise.all([reload(), reloadProducts(), loadRecent()]), [reload, reloadProducts, loadRecent])

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
    <PullToRefresh onRefresh={refresh}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink pb-16 pt-[calc(var(--sat)+12px)] text-white">
        <div className="pointer-events-none absolute -end-24 -top-24 size-72 rotate-45 rounded-[60px] opacity-25 blur-xl sanad-stripe" />
        <div className="page px-g relative">
          <div className="flex min-h-[64px] items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-lg">
              <img src={assetUrl('brands/sanad-mark.png')} alt="" className="size-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/60">{hour < 12 ? t('goodMorning') : t('goodEvening')} 👋</p>
              <h1 className="truncate text-xl font-extrabold leading-tight">{name || t('welcome')}</h1>
            </div>
            <Link to="/notifications" aria-label={t('notifications')} className="icon-btn relative bg-white/10 active:bg-white/20">
              <Bell className="size-[22px]" />
              {unread > 0 && <span key={unread} className="bump absolute end-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-s-red px-1 text-[10px] font-black ring-2 ring-ink">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search" enterKeyHint="search"
              value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-14 w-full rounded-2xl border-0 bg-white ps-12 pe-12 text-ink shadow-xl outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && <button aria-label="clear" onClick={() => setQ('')} className="absolute end-1 top-1/2 grid size-12 -translate-y-1/2 place-items-center text-gray-500"><X className="size-5" /></button>}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1.5 sanad-stripe" />
      </section>

      <div className="page px-g relative -mt-10">
        {error && <ErrorBox message={error} onRetry={reload} />}

        {results ? (
          <section className="card p-3 sm:p-4">
            <p className="mb-3 px-1 text-sm font-bold text-2">{results.length} {t('products')}</p>
            {results.length === 0
              ? <EmptyState icon={<PackageSearch className="size-9" />} title={t('noResults')} />
              : <div className="grid-products">
                  {results.map((p, i) => <ProductCard key={p.id} index={i} product={p} accent={accentOf(p.category_id)} onOpen={() => setOpen(p)} />)}
                </div>}
          </section>
        ) : (
          <>
            <section className="grid-brands">
              {!categories && [0, 1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/5] rounded-[24px]" />)}
              {categories?.map((c, i) => (
                <Link key={c.id} to={`/c/${c.slug}`} className="rise group card relative flex aspect-[4/5] max-h-72 w-full flex-col overflow-hidden rounded-[24px] transition active:scale-[.98]" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="absolute inset-x-0 top-0 z-10 h-1.5" style={{ background: c.accent }} />
                  <div className="flex min-h-0 flex-1 bg-white p-4"><BrandLogo category={c} className="min-h-0 flex-1 !bg-transparent transition duration-500 group-hover:scale-105" /></div>
                  <div className="flex min-h-[60px] items-center gap-2 border-t border-theme px-3 py-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{catName(c)}</p>
                      <p className="truncate text-[11px] font-semibold text-2">{counts[c.id] ?? 0} {t('products')}</p>
                    </div>
                    <Chevron className="size-5 shrink-0 text-2" />
                  </div>
                </Link>
              ))}
            </section>

            {recent && recent.length > 0 && (
              <section className="mt-8">
                <div className="mb-2 flex min-h-12 items-center justify-between">
                  <h2 className="text-lg font-extrabold">{t('recentOrders')}</h2>
                  <Link to="/orders" className="flex min-h-12 items-center px-2 text-sm font-bold text-brand">{t('seeAll')}</Link>
                </div>
                <div className="card divide-y divide-[var(--border)] overflow-hidden">
                  {recent.map(o => (
                    <Link key={o.id} to={`/orders/${o.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3 active:bg-[var(--surface-2)]">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl surface-2 text-xs font-black" dir="ltr">#{o.order_no}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" dir="ltr">{money(o.total, lang)}</p>
                        <p className="truncate text-xs text-2">{o.items_count} {t('items')}</p>
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
    </PullToRefresh>
  )
}
