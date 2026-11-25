import { useEffect, useMemo, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EyeOff, GripVertical, ImageOff, Info, PackageOpen, Plus, Search, Zap } from 'lucide-react'
import { PRESETS, reoptimizeStored } from '../../lib/image'
import { usePrefs } from '../../context/PrefsContext'
import { useCategories, useProducts, useSubcategories } from '../../lib/data'
import { subName } from './AdminCategories'
import { EmptyState, ErrorBox, Skeleton, Thumb } from '../../components/ui'
import ProductForm from './ProductForm'
import { cn, money } from '../../lib/format'
import type { Category, Product, Subcategory } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { haptic } from '../../lib/native'

export default function AdminProducts() {
  const { t, catName } = usePrefs()
  const { categories } = useCategories()
  const [cat, setCat] = useState<string | null>(null)
  const { products, error, reload } = useProducts(null, { includeHidden: true })
  const { subcategories } = useSubcategories(null, { includeHidden: true })
  const subOf = (id: string | null) => subcategories?.find(s => s.id === id)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (products ?? []).filter(p => (!cat || p.category_id === cat) && (!s || [p.name, p.sku].some(v => v?.toLowerCase().includes(s))))
  }, [products, cat, q])
  const catOf = (id: string) => categories?.find(c => c.id === id)
  const toast = useToast()

  // drag & drop ordering: only inside one brand and without a search filter
  const canSort = !!cat && !q.trim()
  const [order, setOrder] = useState<Product[]>([])
  useEffect(() => { setOrder(list) }, [list])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  // one-click: re-compress every stored picture and create missing thumbnails
  const [optimizing, setOptimizing] = useState<string | null>(null)
  async function optimizeAll() {
    const { data: notes } = await supabase.from('notifications').select('image_url').not('image_url', 'is', null)
    const jobs = [
      ...(products ?? []).filter(p => p.image_url).map(p => ({ url: p.image_url!, preset: PRESETS.product })),
      ...((notes as { image_url: string }[] | null) ?? []).map(n => ({ url: n.image_url, preset: PRESETS.banner }))
    ]
    let saved = 0
    for (let i = 0; i < jobs.length; i++) {
      setOptimizing(`${i + 1}/${jobs.length}`)
      try { saved += await reoptimizeStored(jobs[i].url, jobs[i].preset) } catch (e) { console.warn('optimise', jobs[i].url, e) }
    }
    setOptimizing(null)
    toast(`${t('optimizedDone')} ${Math.round(saved / 1024)} KB`)
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = order.findIndex(p => p.id === active.id), to = order.findIndex(p => p.id === over.id)
    const next = arrayMove(order, from, to)
    setOrder(next)
    haptic()
    const { error } = await supabase.rpc('reorder_products', { p_ids: next.map(p => p.id) })
    if (error) { toast(error.message, 'error'); setOrder(list) } else { toast(t('saved')); reload() }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="field ps-12" />
        </div>
        <button onClick={() => setEditing('new')} className="btn btn-primary shrink-0"><Plus className="size-5" /><span className="hidden sm:inline">{t('newProduct')}</span></button>
      </div>
      <div className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)]">
        <button onClick={() => setCat(null)} className={cn('filter-chip', !cat ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'surface border border-theme text-2')}>{t('all')} <span className="opacity-60">{products?.length ?? 0}</span></button>
        {categories?.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn('filter-chip', cat === c.id ? 'text-white' : 'surface border border-theme text-2')} style={cat === c.id ? { background: c.accent } : undefined}>
            {catName(c)} <span className="opacity-70">{products?.filter(p => p.category_id === c.id).length ?? 0}</span>
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!products && <Skeleton className="h-96 rounded-3xl" />}
      {products && list.length === 0 && <EmptyState icon={<PackageOpen className="size-9" />} title={t('noProducts')} action={<button onClick={() => setEditing('new')} className="btn btn-primary"><Plus className="size-5" />{t('newProduct')}</button>} />}
      <button disabled={!!optimizing || !products?.length} onClick={optimizeAll} className="flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-brand disabled:opacity-60">
        <Zap className="size-4" />{optimizing ? `${t('optimizing')} ${optimizing}` : t('optimizeImages')}
      </button>
      {list.length > 0 && !canSort && (
        <p className="flex items-center gap-2 px-1 text-xs font-semibold text-2"><Info className="size-4 shrink-0" />{t('reorderHint')}</p>
      )}
      {list.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map(p => p.id)} strategy={verticalListSortingStrategy} disabled={!canSort}>
            <ul className="card divide-y divide-[var(--border)] overflow-hidden">
              {order.map(p => (
                <ProductRow key={p.id} p={p} sortable={canSort} c={catOf(p.category_id)} sub={subOf(p.subcategory_id)} onOpen={() => setEditing(p)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
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

function ProductRow({ p, c, sub, sortable, onOpen }: { p: Product; c?: Category; sub?: Subcategory; sortable: boolean; onOpen: () => void }) {
  const { t, lang, catName } = usePrefs()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: !sortable })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center surface', isDragging && 'z-10 rounded-2xl shadow-2xl ring-2 ring-[var(--color-brand)]', !p.is_active && 'opacity-50')}>
      {sortable && (
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="drag" className="grid h-full min-h-[72px] w-11 shrink-0 cursor-grab touch-none place-items-center text-2 active:cursor-grabbing">
          <GripVertical className="size-5" />
        </button>
      )}
      <button onClick={onOpen} className={cn('flex min-w-0 flex-1 items-center gap-3 py-3 pe-3 text-start transition hover:bg-[var(--surface-2)]', !sortable && 'ps-3')}>
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
          {p.image_url ? <Thumb src={p.image_url} className="size-full object-contain p-1" /> : <ImageOff className="size-5 text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{p.name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-2">
            {c && <span className="size-2 rounded-full" style={{ background: c.accent }} />}
            {c && catName(c)}{sub && ` · ${subName(sub, lang)}`}{p.size && ` · ${p.size}`}
            {!p.is_active && <EyeOff className="size-3.5" />}
          </p>
        </div>
        <div className="text-end">
          <p className="text-sm font-extrabold" dir="ltr">{money(p.price, lang)}</p>
          {!p.in_stock && <p className="text-[11px] font-bold text-rose-600">{t('outOfStock')}</p>}
        </div>
      </button>
    </li>
  )
}
