import { useState } from 'react'
import { ChevronDown, ChevronUp, EyeOff, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { useCategories, useProducts, useSubcategories } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { BrandLogo, Sheet, Skeleton, Spinner } from '../../components/ui'
import { cn } from '../../lib/format'
import type { Subcategory } from '../../lib/types'

export { subName } from '../../lib/format'
import { subName } from '../../lib/format'

export default function AdminCategories() {
  const { t, lang, catName } = usePrefs()
  const toast = useToast()
  const { categories } = useCategories()
  const { subcategories, reload } = useSubcategories(null, { includeHidden: true })
  const { products } = useProducts(null, { includeHidden: true })
  const [editing, setEditing] = useState<{ sub: Subcategory | null; categoryId: string } | null>(null)

  async function move(list: Subcategory[], i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    await Promise.all([
      supabase.from('subcategories').update({ sort_order: j }).eq('id', a.id),
      supabase.from('subcategories').update({ sort_order: i }).eq('id', b.id)
    ])
    reload()
  }

  async function normalise(list: Subcategory[]) {
    // make sort_order 0..n so moving works predictably
    await Promise.all(list.map((s, i) => s.sort_order === i ? null : supabase.from('subcategories').update({ sort_order: i }).eq('id', s.id)))
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl surface-2 p-3 text-sm text-2"><Tags className="mt-0.5 size-4 shrink-0" />{t('categoryHint')}</p>
      {!categories && <Skeleton className="h-64 rounded-3xl" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {categories?.map(c => {
          const list = (subcategories ?? []).filter(s => s.category_id === c.id)
          return (
            <section key={c.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-theme p-3">
                <BrandLogo category={c} className="h-12 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{catName(c)}</p>
                  <p className="text-xs text-2">{list.length} {t('categories')}</p>
                </div>
                <button onClick={() => setEditing({ sub: null, categoryId: c.id })} className="btn btn-primary min-h-11 px-3 text-sm" style={{ background: c.accent, color: '#fff' }}>
                  <Plus className="size-4" />{t('newCategory')}
                </button>
              </div>
              {list.length === 0 && <p className="p-4 text-center text-sm text-2">—</p>}
              <ul className="divide-y divide-[var(--border)]">
                {list.map((s, i) => (
                  <li key={s.id} className={cn('flex items-center gap-1 py-1 ps-4 pe-1', !s.is_active && 'opacity-50')}>
                    <div className="min-w-0 flex-1 py-2">
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold">{subName(s, lang)}{!s.is_active && <EyeOff className="size-3.5" />}</p>
                      <p className="text-[11px] text-2">{products?.filter(p => p.subcategory_id === s.id).length ?? 0} {t('products')}</p>
                    </div>
                    <button aria-label="up" disabled={i === 0} onClick={async () => { await normalise(list); move(list, i, -1) }} className="icon-btn size-11 disabled:opacity-25"><ChevronUp className="size-5" /></button>
                    <button aria-label="down" disabled={i === list.length - 1} onClick={async () => { await normalise(list); move(list, i, 1) }} className="icon-btn size-11 disabled:opacity-25"><ChevronDown className="size-5" /></button>
                    <button aria-label="edit" onClick={() => setEditing({ sub: s, categoryId: c.id })} className="icon-btn size-11"><Pencil className="size-5" /></button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {editing && (
        <SubcategoryForm
          sub={editing.sub}
          categoryId={editing.categoryId}
          nextOrder={(subcategories ?? []).filter(s => s.category_id === editing.categoryId).length}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); toast(t('saved')) }}
        />
      )}
    </div>
  )
}

function SubcategoryForm({ sub, categoryId, nextOrder, onClose, onSaved }: { sub: Subcategory | null; categoryId: string; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const { t } = usePrefs()
  const toast = useToast()
  const [f, setF] = useState({ name_ku: sub?.name_ku ?? '', name_ar: sub?.name_ar ?? '', name_en: sub?.name_en ?? '', is_active: sub?.is_active ?? true })
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!f.name_ku.trim()) return
    setBusy(true)
    const payload = { name_ku: f.name_ku.trim(), name_ar: f.name_ar.trim() || null, name_en: f.name_en.trim() || null, is_active: f.is_active }
    const { error } = sub
      ? await supabase.from('subcategories').update(payload).eq('id', sub.id)
      : await supabase.from('subcategories').insert({ ...payload, category_id: categoryId, sort_order: nextOrder })
    setBusy(false)
    if (error) toast(error.message, 'error'); else onSaved()
  }
  async function remove() {
    if (!sub || !confirm(t('confirmDelete'))) return
    setBusy(true)
    const { error } = await supabase.from('subcategories').delete().eq('id', sub.id)
    setBusy(false)
    if (error) toast(error.message, 'error'); else onSaved()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="space-y-3 p-5 pt-3">
        <h2 className="text-xl font-extrabold">{sub ? t('category2') : t('newCategory')}</h2>
        <div><label className="label">{t('nameKu')} *</label><input className="field" value={f.name_ku} onChange={e => setF({ ...f, name_ku: e.target.value })} placeholder="بۆیەی ناوەوە" /></div>
        <div><label className="label">{t('nameAr')}</label><input className="field" dir="rtl" value={f.name_ar} onChange={e => setF({ ...f, name_ar: e.target.value })} placeholder="دهانات داخلية" /></div>
        <div><label className="label">{t('nameEn')}</label><input className="field" dir="ltr" value={f.name_en} onChange={e => setF({ ...f, name_en: e.target.value })} placeholder="Interior paint" /></div>
        <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl surface-2 px-4 text-sm font-bold">
          {t('active')}
          <input type="checkbox" className="size-5 accent-[#0284d6]" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} />
        </label>
        <div className="flex gap-2 pt-2">
          {sub && <button disabled={busy} onClick={remove} className="btn btn-danger"><Trash2 className="size-5" /></button>}
          <button disabled={busy || !f.name_ku.trim()} onClick={save} className="btn btn-primary min-h-14 flex-1">{busy && <Spinner />}{t('save')}</button>
        </div>
      </div>
    </Sheet>
  )
}
