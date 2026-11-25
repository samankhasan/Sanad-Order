import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, Megaphone, PackageSearch, ReceiptText, RotateCcw, Search, Sparkles, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useCategories, useProducts } from '../lib/data'
import { supabase } from '../lib/supabase'
import { BrandLogo, EmptyState, ErrorBox, PullToRefresh, Skeleton, StatusBadge } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { assetUrl, cn, money } from '../lib/format'
import type { Order, Product } from '../lib/types'
import { setStatusBarOverride } from '../lib/native'

function SectionTitle({ title, to, icon }: { title: string; to?: string; icon?: React.ReactNode }) {
  const { t } = usePrefs()
  return (
    <div className="mb-3 flex min-h-12 items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">{icon}{title}</h2>
      {to && <Link to={to} className="flex min-h-12 items-center px-2 text-sm font-bold text-brand">{t('seeAll')}</Link>}
    </div>
  )
}

export default function Home() {
  const { t, catName, dir, lang } = usePrefs()
  const { profile, session } = useAuth()
  const { unread, items: notes } = useNotifications()
  const { categories, error, reload } = useCategories()
  const { products, reload: reloadProducts } = useProducts()
  const nav = useNavigate()
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
  const newest = useMemo(() => [...(products ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10), [products])
  const offers = useMemo(() => (notes ?? []).filter(n => !n.target_user).slice(0, 6), [notes])
  const activeOrders = recent?.filter(o => !['delivered', 'cancelled'].includes(o.status)).length ?? 0

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
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-ink pb-20 pt-[calc(var(--sat)+8px)] text-white">
        <div className="pointer-events-none absolute -end-28 -top-28 size-80 rotate-45 rounded-[64px] opacity-30 blur-2xl sanad-stripe" />
        <div className="pointer-events-none absolute -bottom-24 -start-24 size-64 rotate-12 rounded-[56px] bg-brand opacity-20 blur-3xl" />
        <div className="page px-g relative">
          <div className="flex min-h-[64px] items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-lg">
              <img src={assetUrl('brands/sanad-mark.png')} alt="Sanad" className="size-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/60">{hour < 12 ? t('goodMorning') : t('goodEvening')} 👋</p>
              <p className="truncate text-lg font-extrabold leading-tight">{name || t('welcome')}</p>
            </div>
            <Link to="/notifications" aria-label={t('notifications')} className="icon-btn relative bg-white/10 active:bg-white/20">
              <Bell className="size-[22px]" />
              {unread > 0 && <span key={unread} className="bump absolute end-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-s-red px-1 text-[10px] font-black ring-2 ring-ink">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          </div>

          <h1 className="mt-5 max-w-md text-[26px] font-black leading-[1.25] tracking-tight xs:text-[30px]">{t('heroTitle')}</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="chip bg-white/10 text-white/80"><Sparkles className="size-3.5 text-s-yellow" />{t('officialDistributor')}</span>
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {categories?.map(c => (
                <span key={c.id} className="grid size-8 place-items-center overflow-hidden rounded-full bg-white p-1 ring-2 ring-ink"><BrandLogo category={c} className="size-full !bg-transparent" /></span>
              ))}
            </div>
          </div>

          <div className="relative mt-5">
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

      <div className="page px-g relative -mt-12 space-y-7">
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
            {/* ===== Quick actions ===== */}
            <section className="grid grid-cols-3 gap-2 xs:gap-3">
              {[
                { to: '/orders', icon: ReceiptText, label: t('myOrders'), badge: activeOrders, color: '#0284d6' },
                { to: recent?.[0] ? `/orders/${recent[0].id}` : '/orders', icon: RotateCcw, label: t('quickReorder'), color: '#4fa62f' },
                { to: '/notifications', icon: Bell, label: t('notifications'), badge: unread, color: '#f36f21' }
              ].map(a => (
                <Link key={a.label} to={a.to} className="rise card relative flex min-h-[92px] flex-col items-center justify-center gap-2 p-2 text-center active:scale-[.97] transition">
                  <span className="grid size-11 place-items-center rounded-2xl text-white shadow-md" style={{ background: a.color }}><a.icon className="size-5" /></span>
                  <span className="line-clamp-2 text-xs font-bold leading-tight">{a.label}</span>
                  {!!a.badge && <span className="absolute end-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-s-red px-1 text-[10px] font-black text-white">{a.badge}</span>}
                </Link>
              ))}
            </section>

            {/* ===== Offers & news ===== */}
            {offers.length > 0 && (
              <section>
                <SectionTitle title={t('offers')} to="/notifications" icon={<Megaphone className="size-5 text-s-orange" />} />
                <div className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--gutter)] pb-1">
                  {offers.map((n, i) => (
                    <button key={n.id} onClick={() => nav(n.link || '/notifications')}
                      className={cn('relative w-[84%] max-w-sm shrink-0 snap-start overflow-hidden rounded-[24px] text-start text-white shadow-lg active:scale-[.99] transition sm:w-80', !n.image_url && 'p-5')}
                      style={!n.image_url ? { background: ['linear-gradient(135deg,#0b3c7d,#0284d6)', 'linear-gradient(135deg,#7b1b6a,#e10e19)', 'linear-gradient(135deg,#f36f21,#ffcb05)', 'linear-gradient(135deg,#1e7a33,#4fa62f)'][i % 4] } : undefined}>
                      {n.image_url ? (
                        <>
                          <img src={n.image_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                            <p className="line-clamp-1 font-extrabold">{n.title}</p>
                            <p className="line-clamp-1 text-sm text-white/80">{n.body}</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex min-h-[132px] flex-col">
                          <Megaphone className="size-6 opacity-70" />
                          <p className="mt-3 line-clamp-2 text-lg font-extrabold leading-snug">{n.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-white/85">{n.body}</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ===== Brands ===== */}
            <section>
              <SectionTitle title={t('shopAll')} />
              <div className="grid-brands">
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
              </div>
            </section>

            {/* ===== New arrivals ===== */}
            {newest.length > 0 && (
              <section>
                <SectionTitle title={t('newArrivals')} icon={<Sparkles className="size-5 text-s-yellow" />} />
                <div className="no-scrollbar -mx-[var(--gutter)] flex snap-x gap-3 overflow-x-auto px-[var(--gutter)] pb-1">
                  {newest.map((p, i) => (
                    <div key={p.id} className="w-[44%] max-w-[200px] shrink-0 snap-start xs:w-[40%] sm:w-48">
                      <ProductCard index={i} product={p} accent={accentOf(p.category_id)} onOpen={() => setOpen(p)} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===== Recent orders ===== */}
            {recent && recent.length > 0 && (
              <section>
                <SectionTitle title={t('recentOrders')} to="/orders" />
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

            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <div className="h-1 w-16 rounded-full sanad-stripe" />
              <p className="text-xs font-semibold text-2">Sanad Company · Sanad Order</p>
            </div>
          </>
        )}
      </div>
      <ProductSheet product={open} accent={open ? accentOf(open.category_id) : undefined} onClose={() => setOpen(null)} />
    </PullToRefresh>
  )
}
