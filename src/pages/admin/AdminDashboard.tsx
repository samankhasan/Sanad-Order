import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, TrendingUp, Users } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useCategories } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { ErrorBox, Skeleton, StatusBadge } from '../../components/ui'
import { dateTime, money } from '../../lib/format'
import type { Order, OrderItem } from '../../lib/types'
import VisitorStats from './VisitorStats'

export default function AdminDashboard() {
  const { t, lang, catName } = usePrefs()
  const { categories } = useCategories()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [customers, setCustomers] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0)
    const [o, it, c] = await Promise.all([
      supabase.from('orders').select('*, profiles(full_name, phone, shop_name, city)').order('created_at', { ascending: false }).limit(500),
      supabase.from('order_items').select('*, orders!inner(status, created_at)').gte('orders.created_at', since.toISOString()).neq('orders.status', 'cancelled').limit(5000),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer')
    ])
    if (o.error) { setError(o.error.message); return }
    setOrders(o.data as Order[]); setItems((it.data as OrderItem[]) ?? []); setCustomers(c.count ?? 0)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('admin-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const stats = useMemo(() => {
    if (!orders) return null
    const today = new Date().toDateString()
    const month = new Date().getMonth(), year = new Date().getFullYear()
    const live = orders.filter(o => o.status !== 'cancelled')
    return {
      today: orders.filter(o => new Date(o.created_at).toDateString() === today).length,
      pending: orders.filter(o => o.status === 'pending').length,
      revenue: live.filter(o => { const d = new Date(o.created_at); return d.getMonth() === month && d.getFullYear() === year }).reduce((s, o) => s + Number(o.total), 0)
    }
  }, [orders])

  const byBrand = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach(i => { if (i.category_id) m[i.category_id] = (m[i.category_id] || 0) + Number(i.line_total) })
    const max = Math.max(1, ...Object.values(m))
    return (categories ?? []).map(c => ({ c, v: m[c.id] || 0, pct: ((m[c.id] || 0) / max) * 100 }))
  }, [items, categories])

  const top = useMemo(() => {
    const m: Record<string, { name: string; qty: number }> = {}
    items.forEach(i => { const k = i.product_id || i.product_name; m[k] = { name: i.product_name, qty: (m[k]?.qty || 0) + i.quantity } })
    return Object.values(m).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [items])

  if (error) return <ErrorBox message={error} onRetry={load} />
  if (!stats) return <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>

  const tiles = [
    { icon: CalendarDays, label: t('todayOrders'), value: String(stats.today), color: '#0284d6' },
    { icon: Clock, label: t('pendingOrders'), value: String(stats.pending), color: '#f59e0b' },
    { icon: TrendingUp, label: t('revenueMonth'), value: money(stats.revenue, lang), color: '#4fa62f' },
    { icon: Users, label: t('customers'), value: String(customers), color: '#7b1b6a' }
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x, i) => (
          <div key={x.label} className="rise card p-4" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="mb-3 grid size-10 place-items-center rounded-2xl text-white" style={{ background: x.color }}><x.icon className="size-5" /></div>
            <p className="text-xs font-semibold text-2">{x.label}</p>
            <p className="mt-0.5 truncate text-xl font-black" dir="ltr">{x.value}</p>
          </div>
        ))}
      </div>

      <VisitorStats />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-extrabold">{t('byBrand')} · <span className="text-2">{t('revenueMonth')}</span></h2>
          <div className="space-y-3">
            {byBrand.map(({ c, v, pct }) => (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-bold">{catName(c)}</span><span className="font-semibold text-2" dir="ltr">{money(v, lang)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full surface-2"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.accent }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-extrabold">{t('topProducts')}</h2>
          {top.length === 0 ? <p className="text-sm text-2">—</p> : (
            <ol className="space-y-2.5">
              {top.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-7 place-items-center rounded-lg surface-2 text-xs font-black">{i + 1}</span>
                  <span className="flex-1 truncate font-semibold">{p.name}</span>
                  <span className="font-black" dir="ltr">×{p.qty}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">{t('recentOrders')}</h2><Link to="/admin/orders" className="text-sm font-bold text-brand">{t('seeAll')}</Link></div>
        <OrdersTable orders={orders!.slice(0, 8)} />
      </section>
    </div>
  )
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const { t, lang } = usePrefs()
  if (orders.length === 0) return <p className="card p-6 text-center text-sm text-2">{t('noOrders')}</p>
  return (
    <div className="card divide-y divide-[var(--border)] overflow-hidden">
      {orders.map(o => (
        <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-3 p-4 transition hover:bg-[var(--surface-2)]">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl surface-2 text-xs font-black" dir="ltr">#{o.order_no}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{o.profiles?.shop_name || o.profiles?.full_name || '—'}</p>
            <p className="truncate text-xs text-2">{dateTime(o.created_at, lang)} · {o.items_count} {t('items')}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-extrabold" dir="ltr">{money(o.total, lang)}</span>
            <StatusBadge status={o.status} />
          </div>
        </Link>
      ))}
    </div>
  )
}
