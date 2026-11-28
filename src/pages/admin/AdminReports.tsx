import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, Boxes, CalendarRange, FileSpreadsheet, PackageCheck, ReceiptText, ShoppingCart, UserPlus, Users, XCircle } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { usePaymentMethods } from '../../lib/data'
import { placeLabel } from '../../lib/iraq'
import { cn, money } from '../../lib/format'
import { ErrorBox, Skeleton, Spinner } from '../../components/ui'
import type { Lang } from '../../lib/i18n'

type Preset = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom'
interface Report {
  kpi: { orders: number; revenue: number; delivered_revenue: number; paid_revenue: number; cancelled: number; customers: number; items: number; new_members: number; prev_orders: number; prev_revenue: number }
  daily: { d: string; orders: number; revenue: number }[]
  products: { name: string; size: string | null; qty: number; revenue: number; orders: number }[]
  brands: { name_ku: string; name_ar: string; name_en: string; accent: string | null; revenue: number; qty: number }[]
  cities: { city: string; orders: number; revenue: number }[]
  statuses: Record<string, number>
  payments: { code: string; orders: number; revenue: number }[]
}

interface OrderRow {
  order_no: number; created_at: string; status: string; total: number; items_count: number; payment_method: string | null; payment_status: string | null; note: string | null
  delivery: { name?: string; phone?: string; city?: string } | null
  profiles: { full_name: string | null; phone: string | null; city: string | null } | null
}

const STATUSES = ['pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'] as const
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const num = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n) || 0)
/** 12 500 000 → 12.5M (axis labels / compact tiles) */
const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0)

function rangeOf(p: Preset, custom: { from: string; to: string }): [Date, Date] {
  const now = new Date(), today = dayStart(now), tomorrow = new Date(today.getTime() + 864e5)
  switch (p) {
    case 'today': return [today, tomorrow]
    case '7d': return [new Date(today.getTime() - 6 * 864e5), tomorrow]
    case '30d': return [new Date(today.getTime() - 29 * 864e5), tomorrow]
    case 'month': return [new Date(now.getFullYear(), now.getMonth(), 1), tomorrow]
    case 'year': return [new Date(now.getFullYear(), 0, 1), tomorrow]
    case 'custom': {
      const f = custom.from ? new Date(custom.from + 'T00:00') : today
      const t = custom.to ? new Date(new Date(custom.to + 'T00:00').getTime() + 864e5) : tomorrow
      return f < t ? [f, t] : [t, f]
    }
  }
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const { t } = usePrefs()
  if (!prev) return <span className="text-[11px] font-semibold text-2">{now ? t('rpNew') : '—'}</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-extrabold', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')} title={t('rpVsPrev')}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}<bdi dir="ltr">{up ? '+' : ''}{pct}%</bdi>
    </span>
  )
}

function Kpi({ icon, label, value, unit, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone: string }) {
  return (
    <div className="card flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: tone }}>{icon}</span>
        <span className="min-w-0 truncate text-xs font-bold text-2">{label}</span>
      </div>
      <p className="flex min-w-0 items-baseline gap-1 text-xl font-black tabular-nums" dir="ltr"><span className="truncate">{value}</span>{unit && <span className="shrink-0 text-[11px] font-bold text-2">{unit}</span>}</p>
      {sub && <div className="-mt-1">{sub}</div>}
    </div>
  )
}

/** Revenue per day (or per month for long ranges): thin bars, recessive grid, hover/tap tooltip. */
function RevenueChart({ points, lang }: { points: { key: string; label: string; revenue: number; orders: number }[]; lang: Lang }) {
  const { t } = usePrefs()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...points.map(p => p.revenue))
  const ticks = [0, 0.5, 1].map(f => f * max)
  const W = 100 / Math.max(1, points.length)
  const h = hover != null ? points[hover] : null
  return (
    <div className="relative">
      <div className="flex h-56 gap-2" dir="ltr">
        {/* y axis */}
        <div className="flex w-10 shrink-0 flex-col-reverse justify-between pb-6 text-[10px] font-semibold text-2 tabular-nums">
          {ticks.map(v => <span key={v}>{compact(v)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-6 top-0">
            {ticks.map(v => <div key={v} className="absolute inset-x-0 border-t border-dashed border-[var(--border)]" style={{ bottom: `${(v / max) * 100}%` }} />)}
            <div className="absolute inset-0 flex items-end">
              {points.map((p, i) => (
                <button key={p.key} type="button" aria-label={`${p.label}: ${money(p.revenue, lang)}`}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i === hover ? null : i)}
                  className="group flex h-full items-end justify-center px-[1px]" style={{ width: `${W}%` }}>
                  <span className={cn('block w-full max-w-7 rounded-t-[4px] transition-colors', p.revenue ? (hover === i ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-brand)]/75 group-hover:bg-[var(--color-brand)]') : 'bg-transparent')}
                    style={{ height: p.revenue ? `max(3px, ${(p.revenue / max) * 100}%)` : 0 }} />
                </button>
              ))}
            </div>
          </div>
          {/* x labels: first, middle, last */}
          <div className="absolute inset-x-0 bottom-0 flex h-5 items-end justify-between text-[10px] font-semibold text-2">
            {points.length > 0 && [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => <span key={i}>{points[i].label}</span>)}
          </div>
        </div>
      </div>
      {h && (
        <div className="pointer-events-none absolute start-12 top-0 z-10 rounded-xl border border-theme surface px-3 py-2 text-xs shadow-lg">
          <p className="font-extrabold">{h.label}</p>
          <p className="mt-0.5 tabular-nums" dir="ltr">{money(h.revenue, lang)}</p>
          <p className="text-2">{num(h.orders)} {t('rpOrders')}</p>
        </div>
      )}
    </div>
  )
}

function BarList({ rows, total, lang }: { rows: { key: string; label: string; sub?: string; value: number; color?: string | null }[]; total: number; lang: Lang }) {
  return (
    <ul className="space-y-3">
      {rows.map(r => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold"><bdi>{r.label}</bdi>{r.sub && <span className="font-semibold text-2"> · <bdi>{r.sub}</bdi></span>}</span>
            <span className="shrink-0 text-xs font-bold tabular-nums" dir="ltr">{money(r.value, lang)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" dir="ltr">
            <div className="h-full rounded-full" style={{ width: `${total ? Math.max(2, (r.value / total) * 100) : 0}%`, background: r.color || 'var(--color-brand)' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Admin → Reports: sales for a period, compared with the period before, with an Excel export. */
export default function AdminReports() {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const { methods } = usePaymentMethods()
  const [preset, setPreset] = useState<Preset>('30d')
  const [custom, setCustom] = useState(() => ({ from: isoDay(new Date(Date.now() - 29 * 864e5)), to: isoDay(new Date()) }))
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [from, to] = useMemo(() => rangeOf(preset, custom), [preset, custom])

  const load = useCallback(async () => {
    setData(null); setError(null)
    const { data, error } = await supabase.rpc('sales_report', { p_from: from.toISOString(), p_to: to.toISOString() })
    if (error) setError(error.message); else setData(data as Report)
  }, [from, to])
  useEffect(() => { load() }, [load])

  const brandName = (b: Report['brands'][number]) => (lang === 'ar' ? b.name_ar : lang === 'en' ? b.name_en : b.name_ku) || b.name_ku
  const payName = (code: string) => { const m = methods?.find(x => x.code === code); return m ? (lang === 'ar' ? m.name_ar : lang === 'en' ? m.name_en : m.name_ku) : code }
  const fmtDay = (d: Date) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ', { day: 'numeric', month: 'short', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions).format(d)
  const fmtMonth = (d: Date) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ', { month: 'short', year: '2-digit', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions).format(d)

  // one bar per day (gaps filled with 0); per month when the period is longer than ~3 months
  const points = useMemo(() => {
    if (!data) return []
    const byDay = new Map(data.daily.map(d => [d.d, d]))
    const days = Math.round((to.getTime() - from.getTime()) / 864e5)
    if (days <= 92) {
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(from.getTime() + i * 864e5), k = isoDay(d), v = byDay.get(k)
        return { key: k, label: fmtDay(d), revenue: Number(v?.revenue ?? 0), orders: Number(v?.orders ?? 0) }
      })
    }
    const months = new Map<string, { key: string; label: string; revenue: number; orders: number }>()
    for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.set(k, { key: k, label: fmtMonth(d), revenue: 0, orders: 0 })
    }
    data.daily.forEach(d => { const m = months.get(d.d.slice(0, 7)); if (m) { m.revenue += Number(d.revenue); m.orders += Number(d.orders) } })
    return [...months.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, from, to, lang])

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const { buildXlsx, saveFile } = await import('../../lib/xlsx')
      const { data: orders, error } = await supabase.from('orders')
        .select('order_no, created_at, status, total, items_count, payment_method, payment_status, note, delivery, profiles(full_name, phone, city)')
        .gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).order('created_at', { ascending: true }).limit(10000)
      if (error) throw error
      const rtl = lang !== 'en'
      const k = data.kpi
      const periodLabel = `${isoDay(from)} → ${isoDay(new Date(to.getTime() - 1))}`
      const blob = buildXlsx([
        { name: t('rpSummary'), rtl, widths: [34, 22], rows: [
          [t('rpMetric'), t('rpValue')],
          [t('rpPeriod'), periodLabel],
          [t('rpRevenue'), Number(k.revenue)],
          [t('rpOrders'), Number(k.orders)],
          [t('rpAvgOrder'), k.orders ? Math.round(Number(k.revenue) / k.orders) : 0],
          [t('rpCustomers'), Number(k.customers)],
          [t('rpItems'), Number(k.items)],
          [t('rpDelivered'), Number(k.delivered_revenue)],
          [t('rpPaid'), Number(k.paid_revenue)],
          [t('rpCancelled'), Number(k.cancelled)],
          [t('rpNewMembers'), Number(k.new_members)],
          [t('rpPrevRevenue'), Number(k.prev_revenue)],
          [t('rpPrevOrders'), Number(k.prev_orders)]
        ] },
        { name: t('rpByDay'), rtl, totalRow: true, rows: [
          [t('rpDate'), t('rpOrders'), t('rpRevenue')],
          ...data.daily.map(d => [d.d, Number(d.orders), Number(d.revenue)]),
          [t('rpTotal'), Number(k.orders), Number(k.revenue)]
        ] },
        { name: t('rpTopProducts'), rtl, totalRow: true, rows: [
          ['#', t('rpProduct'), t('size'), t('rpQty'), t('rpOrders'), t('rpRevenue')],
          ...data.products.map((p, i) => [i + 1, p.name, p.size ?? '', Number(p.qty), Number(p.orders), Number(p.revenue)]),
          ['', t('rpTotal'), '', data.products.reduce((s, p) => s + Number(p.qty), 0), '', data.products.reduce((s, p) => s + Number(p.revenue), 0)]
        ] },
        { name: t('rpByBrand'), rtl, rows: [[t('rpBrand'), t('rpQty'), t('rpRevenue')], ...data.brands.map(b => [brandName(b), Number(b.qty), Number(b.revenue)])] },
        { name: t('rpByCity'), rtl, rows: [[t('city'), t('rpOrders'), t('rpRevenue')], ...data.cities.map(c => [placeLabel(c.city, lang) || '—', Number(c.orders), Number(c.revenue)])] },
        { name: t('rpOrdersSheet'), rtl, rows: [
          ['#', t('rpDate'), t('rpCustomer'), t('phone'), t('city'), t('rpStatus'), t('rpPayment'), t('rpPaymentStatus'), t('rpItems'), t('rpTotalAmount'), t('note')],
          ...((orders ?? []) as unknown as OrderRow[]).map(o => [
            Number(o.order_no), new Date(o.created_at).toLocaleString('en-GB', { hour12: false }).replace(',', ''),
            o.delivery?.name || o.profiles?.full_name || '', o.delivery?.phone || o.profiles?.phone || '', placeLabel(o.delivery?.city || o.profiles?.city, lang) || '',
            t(`status_${o.status}` as never), payName(o.payment_method ?? 'cash'), o.payment_status === 'paid' ? t('paid') : t('unpaid'),
            Number(o.items_count), Number(o.total), o.note ?? ''
          ])
        ] }
      ])
      await saveFile(blob, `Sanad-Sales-${isoDay(from)}_${isoDay(new Date(to.getTime() - 1))}.xlsx`)
    } catch (e) { toast((e as Error).message, 'error') }
    setExporting(false)
  }

  const k = data?.kpi
  const cur = lang === 'en' ? 'IQD' : 'د.ع'
  const presets: [Preset, string][] = [['today', t('rpToday')], ['7d', t('rp7d')], ['30d', t('rp30d')], ['month', t('rpMonth')], ['year', t('rpYear')], ['custom', t('rpCustom')]]

  return (
    <div className="space-y-4 pb-8">
      {/* period + export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 basis-60 gap-2 overflow-x-auto">
          {presets.map(([p, label]) => (
            <button key={p} onClick={() => setPreset(p)} className={cn('filter-chip shrink-0', preset === p && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>
              {p === 'custom' && <CalendarRange className="size-4" />}{label}
            </button>
          ))}
        </div>
        <button onClick={exportExcel} disabled={!data || exporting} className="btn min-h-11 shrink-0 bg-[#107C41] px-4 text-sm text-white">
          {exporting ? <Spinner className="size-4" /> : <FileSpreadsheet className="size-4" />}Excel
        </button>
      </div>
      {preset === 'custom' && (
        <div className="card grid grid-cols-2 gap-3 p-3">
          <label className="text-xs font-bold text-2">{t('rpFrom')}<input type="date" className="field mt-1" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label>
          <label className="text-xs font-bold text-2">{t('rpTo')}<input type="date" className="field mt-1" value={custom.to} min={custom.from} max={isoDay(new Date())} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} /></label>
        </div>
      )}
      <p className="px-1 text-xs font-semibold text-2"><bdi dir="ltr">{isoDay(from)} → {isoDay(new Date(to.getTime() - 1))}</bdi> · {t('rpCompareHint')}</p>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>}

      {data && k && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi tone="#0284d6" icon={<Banknote className="size-5" />} label={t('rpRevenue')} value={num(k.revenue)} unit={cur} sub={<Delta now={Number(k.revenue)} prev={Number(k.prev_revenue)} />} />
            <Kpi tone="#4fa62f" icon={<ShoppingCart className="size-5" />} label={t('rpOrders')} value={num(k.orders)} sub={<Delta now={k.orders} prev={k.prev_orders} />} />
            <Kpi tone="#f36f21" icon={<ReceiptText className="size-5" />} label={t('rpAvgOrder')} value={num(k.orders ? Number(k.revenue) / k.orders : 0)} unit={cur} />
            <Kpi tone="#7c3aed" icon={<Users className="size-5" />} label={t('rpCustomers')} value={num(k.customers)} />
            <Kpi tone="#0f766e" icon={<Boxes className="size-5" />} label={t('rpItems')} value={num(k.items)} />
            <Kpi tone="#15803d" icon={<PackageCheck className="size-5" />} label={t('rpDelivered')} value={num(k.delivered_revenue)} unit={cur} />
            <Kpi tone="#db2777" icon={<UserPlus className="size-5" />} label={t('rpNewMembers')} value={num(k.new_members)} />
            <Kpi tone="#64748b" icon={<XCircle className="size-5" />} label={t('rpCancelled')} value={num(k.cancelled)} />
          </div>

          <section className="card min-w-0 p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-extrabold">{t('rpRevenueOverTime')}</h2>
              <span className="text-xs font-semibold text-2">{points.length > 0 && points[0].key.length === 7 ? t('rpPerMonth') : t('rpPerDay')}</span>
            </div>
            {Number(k.revenue) > 0
              ? <RevenueChart points={points} lang={lang} />
              : <p className="grid h-40 place-items-center rounded-2xl surface-2 text-sm font-semibold text-2">{t('rpNoSales')}</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card min-w-0 p-4">
              <h2 className="mb-3 font-extrabold">{t('rpTopProducts')}</h2>
              {data.products.length
                ? <BarList lang={lang} total={Number(data.products[0].revenue)} rows={data.products.slice(0, 10).map((p, i) => ({ key: p.name + i, label: `${i + 1}. ${p.name}`, sub: `${num(p.qty)} ${t('rpPcs')}`, value: Number(p.revenue) }))} />
                : <p className="text-sm text-2">—</p>}
            </section>
            <section className="card min-w-0 p-4">
              <h2 className="mb-3 font-extrabold">{t('rpByBrand')}</h2>
              {data.brands.length
                ? <BarList lang={lang} total={Number(k.revenue) || 1} rows={data.brands.map((b, i) => ({ key: b.name_en + i, label: brandName(b), sub: `${Math.round((Number(b.revenue) / (Number(k.revenue) || 1)) * 100)}%`, value: Number(b.revenue), color: b.accent }))} />
                : <p className="text-sm text-2">—</p>}
            </section>
            <section className="card min-w-0 p-4">
              <h2 className="mb-3 font-extrabold">{t('rpByCity')}</h2>
              {data.cities.length
                ? <BarList lang={lang} total={Number(data.cities[0].revenue)} rows={data.cities.slice(0, 8).map(c => ({ key: c.city || '—', label: placeLabel(c.city, lang) || '—', sub: `${num(c.orders)} ${t('rpOrders')}`, value: Number(c.revenue) }))} />
                : <p className="text-sm text-2">—</p>}
            </section>
            <section className="card min-w-0 space-y-4 p-4">
              <div>
                <h2 className="mb-3 font-extrabold">{t('rpByStatus')}</h2>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <span key={s} className="chip surface-2 text-xs">{t(`status_${s}` as const)} <b dir="ltr" className="tabular-nums">{num(data.statuses[s] ?? 0)}</b></span>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-3 font-extrabold">{t('rpByPayment')}</h2>
                {data.payments.length
                  ? <BarList lang={lang} total={Number(k.revenue) || 1} rows={data.payments.map(p => ({ key: p.code, label: payName(p.code), sub: `${num(p.orders)} ${t('rpOrders')}`, value: Number(p.revenue) }))} />
                  : <p className="text-sm text-2">—</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
