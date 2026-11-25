import { useMemo, useState } from 'react'
import { EyeOff, ImageOff, PackageOpen, Plus, Search } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useCategories, useProducts } from '../../lib/data'
import { EmptyState, ErrorBox, Skeleton } from '../../components/ui'
import ProductForm from './ProductForm'
import { cn, money } from '../../lib/format'
import type { Product } from '../../lib/types'

export default function AdminProducts() {
  const { t, lang, catName } = usePrefs()
  const { categories } = useCategories()
  const [cat, setCat] = useState<string | null>(null)
  const { products, error, reload } = useProducts(null, { includeHidden: true })
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (products ?? []).filter(p => (!cat || p.category_id === cat) && (!s || [p.name, p.sku].some(v => v?.toLowerCase().includes(s))))
  }, [products, cat, q])
  const catOf = (id: string) => categories?.find(c => c.id === id)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12" />
        </div>
        <button onClick={() => setEditing('new')} className="btn btn-primary shrink-0"><Plus className="size-5" /><span className="hidden sm:inline">{t('newProduct')}</span></button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setCat(null)} className={cn('chip shrink-0 py-2', !cat ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'surface border border-theme text-2')}>{t('all')} <span className="opacity-60">{products?.length ?? 0}</span></button>
        {categories?.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn('chip shrink-0 py-2', cat === c.id ? 'text-white' : 'surface border border-theme text-2')} style={cat === c.id ? { background: c.accent } : undefined}>
            {catName(c)} <span className="opacity-70">{products?.filter(p => p.category_id === c.id).length ?? 0}</span>
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!products && <Skeleton className="h-96 rounded-3xl" />}
      {products && list.length === 0 && <EmptyState icon={<PackageOpen className="size-9" />} title={t('noProducts')} action={<button onClick={() => setEditing('new')} className="btn btn-primary"><Plus className="size-5" />{t('newProduct')}</button>} />}
      {list.length > 0 && (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {list.map(p => {
            const c = catOf(p.category_id)
            return (
              <button key={p.id} onClick={() => setEditing(p)} className={cn('flex w-full items-center gap-3 p-3 text-start transition hover:bg-[var(--surface-2)]', !p.is_active && 'opacity-50')}>
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                  {p.image_url ? <img src={p.image_url} alt="" className="size-full object-contain p-1" loading="lazy" /> : <ImageOff className="size-5 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-2">
                    {c && <span className="size-2 rounded-full" style={{ background: c.accent }} />}
                    {c && catName(c)}{p.size && ` · ${p.size}`}
                    {!p.is_active && <EyeOff className="size-3.5" />}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-extrabold" dir="ltr">{money(p.price, lang)}</p>
                  {!p.in_stock && <p className="text-[11px] font-bold text-rose-600">{t('outOfStock')}</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          defaultCategory={cat ?? categories?.[0]?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </div>
  )
}
