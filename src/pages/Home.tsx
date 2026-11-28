import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { Bell, BellRing, ChevronLeft, ChevronRight, Flame, LifeBuoy, MessageCircle, Star, PackageSearch, ReceiptText, RotateCcw, Search, Sparkles, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useBanners, useCategories, usePopularProducts, useProducts } from '../lib/data'
import { supabase } from '../lib/supabase'
import { BrandLogo, EmptyState, ErrorBox, PullToRefresh, Skeleton, Spinner, StatusBadge } from '../components/ui'
import ProductCard from '../components/ProductCard'
import ProductSheet from '../components/ProductSheet'
import { assetUrl, cn, money } from '../lib/format'
import type { HomeBanner, Order, Product } from '../lib/types'
import { setStatusBarOverride } from '../lib/native'
import { enablePush, isNative, pushState } from '../lib/push'

function SectionTitle({ title, to, icon }: { title: string; to?: string; icon?: React.ReactNode }) {
  const { t } = usePrefs()
  return (
    <div className="mb-3 flex min-h-12 items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">{icon}{title}</h2>
      {to && <Link to={to} className="flex min-h-12 items-center px-2 text-sm font-bold text-brand">{t('seeAll')}</Link>}
    </div>
  )
}

type StripTab = { key: string; label: string; icon: React.ReactNode; items: Product[]; ranked?: boolean; empty?: string }

/** One horizontal row of products; the title row switches between lists (newest / most popular). */
function ProductStrip({ tabs, accentOf, onOpen }: { tabs: StripTab[]; accentOf: (id: string) => string | undefined; onOpen: (p: Product) => void }) {
  // always opens on the first tab (newest); the member can switch to the others
  const [active, setActive] = useState(tabs[0]?.key)
  const tab = tabs.find(x => x.key === active) ?? tabs[0]
  if (!tab) return null
  return (
    <section>
      <div className="no-scrollbar mb-3 flex min-h-12 items-center gap-2 overflow-x-auto">
        {tabs.map(x => (
          <button key={x.key} onClick={() => setActive(x.key)} aria-pressed={x.key === tab.key}
            className={cn('flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold transition',
              x.key === tab.key ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow' : 'surface-2 text-2')}>
            {x.icon}{x.label}
          </button>
        ))}
      </div>
      {tab.items.length === 0 && tab.empty && <p className="card p-6 text-center text-sm font-semibold text-2">{tab.empty}</p>}
      <div key={tab.key} className="no-scrollbar -mx-[var(--gutter)] flex snap-x gap-3 overflow-x-auto px-[var(--gutter)] pb-1">
        {tab.items.map((p, i) => (
          <div key={p.id} className="w-[44%] max-w-[200px] shrink-0 snap-start xs:w-[40%] sm:w-48">
            <ProductCard index={i} product={p} accent={accentOf(p.category_id)} onOpen={() => onOpen(p)} rank={tab.ranked ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Ad banners set by the admin (Admin → Ads). Swipeable; advances on its own every few seconds. */
function Banners({ items }: { items: HomeBanner[] }) {
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0)
  const many = items.length > 1
  useEffect(() => {
    if (!many) return
    const id = setInterval(() => {
      const el = ref.current; if (!el) return
      const next = (cur + 1) % items.length
      const child = el.children[next] as HTMLElement | undefined
      const r = el.getBoundingClientRect()
      // only while the banners are fully on screen, so the page never jumps
      if (child && r.top >= 0 && r.bottom <= innerHeight) child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, 5000)
    return () => clearInterval(id)
  }, [cur, many, items.length])
  function onScroll() {
    const el = ref.current; if (!el) return
    const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth || 1
    setCur(Math.min(items.length - 1, Math.round(Math.abs(el.scrollLeft) / w)))
  }
  function open(link: string | null) {
    if (!link) return
    if (/^https?:\/\//i.test(link)) {
      if (Capacitor.isNativePlatform()) Browser.open({ url: link })
      else window.open(link, '_blank', 'noopener')
    } else navigate(link.replace(/^#/, ''))
  }
  return (
    <section>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--gutter)] sm:justify-center">
        {items.map(b => (
          <button key={b.slot} onClick={() => open(b.link)} disabled={!b.link}
            className={cn('rise relative aspect-[2/1] shrink-0 snap-center overflow-hidden rounded-[24px] bg-[var(--surface-2)] shadow-sm transition active:scale-[.98] disabled:active:scale-100', many ? 'w-[88%] sm:w-[calc(50%-6px)] sm:max-w-[520px]' : 'w-full sm:max-w-[620px]')}>
            <img src={b.image_url!} alt="" className="size-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      {many && (
        <div className="mt-2 flex justify-center gap-1.5 sm:hidden">
          {items.map((b, i) => <span key={b.slot} className={cn('h-1.5 rounded-full transition-all', i === cur ? 'w-5 bg-[var(--primary)]' : 'w-1.5 bg-[var(--surface-3)]')} />)}
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const { t, catName, dir, lang } = usePrefs()
  const { profile, session } = useAuth()
  const { unread } = useNotifications()
  const { categories, error, reload } = useCategories()
  const { products, reload: reloadProducts } = useProducts()
  const { popular, reload: reloadPopular } = usePopularProducts(10)
  const { banners, reload: reloadBanners } = useBanners()
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

  // a product from a recently delivered order that the member has not rated yet → invite them to rate it
  const [toRate, setToRate] = useState<string | null>(null)
  const [rateFocus, setRateFocus] = useState(false)
  useEffect(() => {
    const o = recent?.find(x => x.status === 'delivered' && Date.now() - new Date(x.updated_at).getTime() < 14 * 864e5)
    if (!o || !session) { setToRate(null); return }
    let live = true
    ;(async () => {
      const { data: items } = await supabase.from('order_items').select('product_id').eq('order_id', o.id)
      const ids = [...new Set(((items as { product_id: string | null }[]) ?? []).map(i => i.product_id).filter(Boolean))] as string[]
      if (!ids.length) { if (live) setToRate(null); return }
      const { data: done } = await supabase.from('product_reviews').select('product_id').eq('user_id', session.user.id).in('product_id', ids)
      const rated = new Set(((done as { product_id: string }[]) ?? []).map(r => r.product_id))
      if (live) setToRate(ids.find(id => !rated.has(id)) ?? null)
    })()
    return () => { live = false }
  }, [recent, session])
  // website: invite the member to turn on notifications (rewards, order updates); "Later" hides it for a week
  const [askPush, setAskPush] = useState(() => {
    if (isNative || pushState() !== 'default') return false
    try { return Date.now() - Number(localStorage.getItem('so.pushAskLater') || 0) > 7 * 864e5 } catch { return true }
  })
  const [pushBusy, setPushBusy] = useState(false)
  const nav = useNavigate()
  async function turnOnPush() {
    setPushBusy(true)
    try { await enablePush(p => nav(p)) } catch { /* the Notifications page shows details */ }
    setPushBusy(false); setAskPush(false)
  }
  function pushLater() { try { localStorage.setItem('so.pushAskLater', String(Date.now())) } catch { /* ignore */ } setAskPush(false) }

  const rateProduct = useMemo(() => products?.find(p => p.id === toRate) ?? null, [products, toRate])
  useEffect(() => { setStatusBarOverride('light'); return () => setStatusBarOverride(null) }, [])
  const refresh = useCallback(() => Promise.all([reload(), reloadProducts(), reloadPopular(), reloadBanners(), loadRecent()]), [reload, reloadProducts, reloadPopular, reloadBanners, loadRecent])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    products?.forEach(p => { m[p.category_id] = (m[p.category_id] || 0) + 1 })
    return m
  }, [products])
  const newest = useMemo(() => [...(products ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10), [products])
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

          <h1 className="mt-4 max-w-md text-[24px] font-black leading-[1.3] tracking-tight xs:text-[28px]">{t('heroTitle')}</h1>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
            <Sparkles className="size-3.5 text-s-yellow" />{t('officialDistributor')} · <span dir="ltr">Adan · FAB · Riyadh · Tools</span>
          </p>

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
            {/* ===== Rate a delivered order ===== */}
            {rateProduct && (
              <button type="button" onClick={() => { setRateFocus(true); setOpen(rateProduct) }} className="rise card flex w-full items-center gap-3 p-3 text-start ring-2 ring-amber-400/40 transition active:scale-[.99]">
                <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
                  {rateProduct.image_url ? <img src={rateProduct.image_url} alt="" className="size-full object-contain p-1" /> : <Star className="size-6 text-amber-400" fill="currentColor" strokeWidth={0} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-2">{t('rateDeliveredTitle')}</p>
                  <p className="truncate font-extrabold">{rateProduct.name}</p>
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400"><span dir="ltr" className="shrink-0">★★★★★</span><span className="truncate">{t('howWasProduct')}</span></p>
                </div>
                <Chevron className="size-5 shrink-0 text-2" />
              </button>
            )}

            {/* ===== Turn on notifications (website) ===== */}
            {askPush && (
              <section className="rise flex items-center gap-3 rounded-[22px] bg-ink p-4 text-white shadow-lg dark:bg-[var(--surface-2)]">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10"><BellRing className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{t('pushAskTitle')}</p>
                  <p className="text-xs leading-5 text-white/70">{t('pushAskHint')}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={turnOnPush} disabled={pushBusy} className="btn min-h-10 bg-white px-4 py-1.5 text-sm text-ink">{pushBusy ? <Spinner className="size-4" /> : <Bell className="size-4" />}{t('turnOn')}</button>
                    <button onClick={pushLater} className="btn min-h-10 px-3 py-1.5 text-sm text-white/80">{t('later')}</button>
                  </div>
                </div>
              </section>
            )}

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

            {/* ===== Ads (admin-managed) ===== */}
            {banners && banners.length > 0 && <Banners items={banners} />}

            {/* ===== Newest / most popular (one row) ===== */}
            <ProductStrip accentOf={accentOf} onOpen={setOpen} tabs={[
              { key: 'new', label: t('newArrivals'), icon: <Sparkles className="size-4" />, items: newest },
              { key: 'popular', label: t('popularTab'), icon: <Flame className="size-4" />, items: popular ?? [], ranked: true, empty: t('noSalesYet') }
            ]} />

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

            {/* ===== Help ===== */}
            <Link to="/support" className="card flex min-h-[76px] items-center gap-3 p-4 transition active:scale-[.99]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white shadow-md"><LifeBuoy className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{t('supportTitle')}</p>
                <p className="line-clamp-2 text-xs text-2">{t('supportShort')}</p>
              </div>
              <Chevron className="size-5 shrink-0 text-2" />
            </Link>

            <footer className="flex flex-col items-center gap-1.5 pt-2 text-center text-xs font-semibold text-2">
              <div className="mb-1 h-1 w-16 rounded-full sanad-stripe" />
              <p dir="ltr">Sanad Company © 2026</p>
              <p dir="ltr">Created by{' '}
                <a href="https://wa.me/9647508418593" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-extrabold text-[#25D366] underline-offset-2 hover:underline">
                  Saman <MessageCircle className="size-3.5" />
                </a>
              </p>
            </footer>
          </>
        )}
      </div>
      <ProductSheet product={open} accent={open ? accentOf(open.category_id) : undefined} focusRating={rateFocus} onClose={() => { setOpen(null); setRateFocus(false); if (rateFocus) { loadRecent(); reloadProducts() } }} />
    </PullToRefresh>
  )
}
