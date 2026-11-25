import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { supabase } from '../../lib/supabase'
import { ErrorBox, Skeleton } from '../../components/ui'
import { OrdersTable } from './AdminDashboard'
import { cn } from '../../lib/format'
import { ORDER_FLOW, type Order, type OrderStatus } from '../../lib/types'

export default function AdminOrders() {
  const { t } = usePrefs()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [q, setQ] = useState('')

  async function load() {
    const { data, error } = await supabase.from('orders').select('*, profiles(full_name, phone, shop_name, city, address, username)').order('created_at', { ascending: false }).limit(1000)
    if (error) setError(error.message); else setOrders(data as Order[])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('admin-orders-list').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (orders ?? []).filter(o =>
      (filter === 'all' || o.status === filter) &&
      (!s || String(o.order_no).includes(s) || [o.profiles?.full_name, o.profiles?.username, o.profiles?.phone, o.profiles?.address, o.profiles?.city].some(v => v?.toLowerCase().includes(s))))
  }, [orders, filter, q])

  const count = (s: OrderStatus) => orders?.filter(o => o.status === s).length ?? 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="#1001, name, phone…" className="field ps-12" />
      </div>
      <div className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)]">
        {(['all', ...ORDER_FLOW, 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn('filter-chip transition', filter === s ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'surface border border-theme text-2')}>
            {s === 'all' ? t('all') : t(`status_${s}` as const)}
            {s !== 'all' && <span className="opacity-60">{count(s)}</span>}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!orders ? <Skeleton className="h-96 rounded-3xl" /> : <OrdersTable orders={list} />}
    </div>
  )
}
