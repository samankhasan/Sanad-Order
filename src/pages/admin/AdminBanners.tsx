import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Megaphone, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { useBanners, useCategories } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { PRESETS, uploadOptimized } from '../../lib/image'
import { Skeleton, Spinner } from '../../components/ui'
import { cn } from '../../lib/format'
import type { HomeBanner } from '../../lib/types'

const CUSTOM = '__custom__'

function BannerSlot({ banner, onSaved }: { banner: HomeBanner; onSaved: () => void }) {
  const { t, catName } = usePrefs()
  const toast = useToast()
  const { categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ image_url: banner.image_url ?? '', link: banner.link ?? '', is_active: banner.is_active })
  const [busy, setBusy] = useState<'upload' | 'save' | null>(null)
  useEffect(() => { setF({ image_url: banner.image_url ?? '', link: banner.link ?? '', is_active: banner.is_active }) }, [banner])

  const presets = [...(categories ?? []).map(c => ({ v: `/c/${c.slug}`, l: catName(c) })), { v: '/orders', l: t('orders') }]
  const isPreset = !f.link || presets.some(p => p.v === f.link)
  const [custom, setCustom] = useState(!isPreset)
  const dirty = f.image_url !== (banner.image_url ?? '') || f.link !== (banner.link ?? '') || f.is_active !== banner.is_active

  async function upload(file: File) {
    setBusy('upload')
    try { setF(s => ({ ...s, image_url: '' })); const url = await uploadOptimized(file, 'banners', PRESETS.banner); setF(s => ({ ...s, image_url: url })) }
    catch (e) { toast((e as Error).message, 'error'); setF(s => ({ ...s, image_url: banner.image_url ?? '' })) }
    setBusy(null)
  }

  async function save() {
    let link = f.link.trim() || null
    if (link && custom && !/^(https?:\/\/|\/)/i.test(link)) link = 'https://' + link
    setBusy('save')
    const { error } = await supabase.from('home_banners')
      .update({ image_url: f.image_url || null, link, is_active: f.is_active, updated_at: new Date().toISOString() })
      .eq('slot', banner.slot)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    toast(t('saved')); onSaved()
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold"><Megaphone className="size-5" />{t('bannerSlot')} {banner.slot}</h2>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
          {t('active')}
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} />
        </label>
      </div>

      <div className={cn('relative aspect-[2/1] overflow-hidden rounded-2xl border border-theme surface-2', !f.is_active && 'opacity-50')}>
        {f.image_url
          ? <img src={f.image_url} alt="" className="size-full object-cover" />
          : <div className="grid size-full place-items-center text-2">{busy === 'upload' ? <Spinner /> : <ImageIcon className="size-10" />}</div>}
        {f.image_url && (
          <button aria-label={t('delete')} onClick={() => setF({ ...f, image_url: '' })} className="absolute end-2 top-2 grid size-10 place-items-center rounded-full bg-black/60 text-white"><Trash2 className="size-4" /></button>
        )}
      </div>
      <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-ghost w-full">
        {busy === 'upload' ? <Spinner /> : <Camera className="size-5" />}{f.image_url ? t('changeImage') : t('uploadImage')}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = '' }} />

      <div className="space-y-2">
        <label className="label">{t('bannerLink')}</label>
        <select className="field" value={custom ? CUSTOM : f.link} onChange={e => {
          if (e.target.value === CUSTOM) { setCustom(true); setF({ ...f, link: '' }) }
          else { setCustom(false); setF({ ...f, link: e.target.value }) }
        }}>
          <option value="">{t('linkNoneBanner')}</option>
          {presets.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
          <option value={CUSTOM}>{t('linkCustom')}</option>
        </select>
        {custom && <input className="field" dir="ltr" inputMode="url" placeholder="https://" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} />}
      </div>

      <button onClick={save} disabled={!dirty || !!busy} className="btn btn-primary w-full py-4">{busy === 'save' && <Spinner />}{t('save')}</button>
    </section>
  )
}

export default function AdminBanners() {
  const { t } = usePrefs()
  const { banners, reload } = useBanners(true)
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl surface-2 p-3 text-sm text-2"><Megaphone className="mt-0.5 size-4 shrink-0" />{t('bannerHint')}</p>
      {!banners && <Skeleton className="h-72 rounded-3xl" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {banners?.map(b => <BannerSlot key={b.slot} banner={b} onSaved={reload} />)}
      </div>
    </div>
  )
}
