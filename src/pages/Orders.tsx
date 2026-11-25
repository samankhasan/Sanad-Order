import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ReceiptText } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { EmptyState, ErrorBox, PageHeader, Skeleton, StatusBadge } from '../components/ui'
import { dateTime, money } from '../lib/format'
import type { Order } from '../lib/types'

export default function Orders() {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!session) return
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (error) setError(error.message); else setOrders(data as Order[])
  }
  useEffect(() => {
    load()
    if (!session) return
    const ch = supabase.channel('my-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${session.user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  return (
    <div>
      <PageHeader title={t('orders')} />
      {error && <ErrorBox message={error} onRetry={load} />}
      <div className="page-narrow px-g space-y-3">
        {!orders && [0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}
        {orders?.length === 0 && <EmptyState icon={<ReceiptText className="size-9" />} title={t('noOrders')} hint={t('noOrdersHint')} action={<Link to="/" className="btn btn-primary">{t('browse')}</Link>} />}
        {orders?.map((o, i) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="rise card flex items-center gap-4 p-4 active:scale-[.99] transition" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-sm font-black text-white dark:bg-white dark:text-ink" dir="ltr">#{o.order_no}</div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold" dir="ltr">{money(o.total, lang)}</p>
              <p className="text-xs text-2">{o.items_count} {t('items')} · {dateTime(o.created_at, lang)}</p>
            </div>
            <StatusBadge status={o.status} />
          </Link>
        ))}
      </div>
    </div>
  )
}
