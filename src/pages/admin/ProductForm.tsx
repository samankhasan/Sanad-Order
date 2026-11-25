import { useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { useCategories, useSubcategories } from '../../lib/data'
import { subName } from './AdminCategories'
import { supabase, IMAGE_BUCKET } from '../../lib/supabase'
import { compressImage } from '../../lib/image'
import { Sheet, Spinner } from '../../components/ui'
import { cn } from '../../lib/format'
import { UNITS, type Product } from '../../lib/types'

export default function ProductForm({ product, defaultCategory, onClose, onSaved }: { product: Product | null; defaultCategory: string; onClose: () => void; onSaved: () => void }) {
  const { t, catName, lang } = usePrefs()
  const toast = useToast()
  const { categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'save' | 'upload' | 'delete' | null>(null)
  const [f, setF] = useState({
    category_id: product?.category_id ?? defaultCategory,
    subcategory_id: product?.subcategory_id ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    sku: product?.sku ?? '',
    size: product?.size ?? '',
    unit: product?.unit ?? 'piece',
    price: product ? String(product.price) : '',
    image_url: product?.image_url ?? '',
    in_stock: product?.in_stock ?? true,
    is_active: product?.is_active ?? true,
    sort_order: product?.sort_order ?? 0
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))
  const { subcategories } = useSubcategories(f.category_id, { includeHidden: true })

  async function upload(file: File) {
    setBusy('upload')
    try {
      const blob = await compressImage(file)
      const path = `${f.category_id}/${crypto.randomUUID()}.webp`
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) throw error
      set('image_url', supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl)
    } catch (e) { toast((e as Error).message, 'error') }
    setBusy(null)
  }

  async function save() {
    if (!f.name.trim() || !f.category_id) return
    setBusy('save')
    const payload = { ...f, subcategory_id: f.subcategory_id || null, price: Number(f.price) || 0, name: f.name.trim(), description: f.description || null, sku: f.sku || null, size: f.size || null, image_url: f.image_url || null }
    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload)
    setBusy(null)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); onSaved() }
  }

  async function remove() {
    if (!product || !confirm(t('confirmDelete'))) return
    setBusy('delete')
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    setBusy(null)
    if (error) toast(error.message, 'error'); else onSaved()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-3">
        <h2 className="text-xl font-extrabold">{product ? t('editProduct') : t('newProduct')}</h2>
        <button aria-label="close" onClick={onClose} className="grid size-10 place-items-center rounded-xl surface-2"><X className="size-5" /></button>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="label">{t('category')}</p>
          <div className="grid grid-cols-2 gap-2">
            {categories?.map(c => (
              <button key={c.id} onClick={() => setF(s => ({ ...s, category_id: c.id, subcategory_id: '' }))} className={cn('btn py-2.5 text-sm', f.category_id === c.id ? 'text-white' : 'btn-ghost')} style={f.category_id === c.id ? { background: c.accent } : undefined}>{catName(c)}</button>
            ))}
          </div>
        </div>

        {subcategories && subcategories.length > 0 && (
          <div>
            <p className="label">{t('category2')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!f.subcategory_id} onClick={() => set('subcategory_id', '')} className="filter-chip">{t('noCategory')}</button>
              {subcategories.map(s => (
                <button type="button" key={s.id} aria-pressed={f.subcategory_id === s.id} onClick={() => set('subcategory_id', s.id)} className="filter-chip">{subName(s, lang)}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="label">{t('image')}</p>
          <div className="flex items-center gap-3">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-theme bg-white">
              {busy === 'upload' ? <Spinner className="text-gray-400" /> : f.image_url ? <img src={f.image_url} alt="" className="size-full object-contain p-1" /> : <Camera className="size-7 text-gray-300" />}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => fileRef.current?.click()} className="btn btn-ghost py-2.5 text-sm"><Camera className="size-4" />{t('uploadImage')}</button>
              {f.image_url && <button onClick={() => set('image_url', '')} className="text-xs font-bold text-rose-600">{t('delete')}</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = '' }} />
          </div>
        </div>

        <div><label className="label">{t('name')} *</label><input className="field" value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t('price')} (IQD)</label><input className="field" dir="ltr" inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value.replace(/[^\d.]/g, ''))} /></div>
          <div><label className="label">{t('sku')}</label><input className="field" dir="ltr" value={f.sku} onChange={e => set('sku', e.target.value)} /></div>
          <div><label className="label">{t('size')}</label><input className="field" placeholder="18L, 4kg, 3m…" value={f.size} onChange={e => set('size', e.target.value)} /></div>
          <div>
            <label className="label">{t('unit')}</label>
            <select className="field" value={f.unit} onChange={e => set('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{t(`unit_${u}` as const)}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">{t('description')}</label><textarea rows={3} className="field resize-none" value={f.description} onChange={e => set('description', e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-2">
          {([['in_stock', t('inStock')], ['is_active', t('active')]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-2 rounded-2xl surface-2 p-3.5 text-sm font-bold">
              {label}
              <input type="checkbox" className="size-5 accent-[#0284d6]" checked={f[k]} onChange={e => set(k, e.target.checked)} />
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          {product && <button disabled={!!busy} onClick={remove} className="btn btn-danger">{busy === 'delete' ? <Spinner /> : <Trash2 className="size-5" />}</button>}
          <button disabled={!!busy || !f.name.trim()} onClick={save} className="btn btn-primary flex-1 py-4">{busy === 'save' && <Spinner />}{t('save')}</button>
        </div>
      </div>
    </Sheet>
  )
}
