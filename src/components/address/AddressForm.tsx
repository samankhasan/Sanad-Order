import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Crosshair, Home, Landmark, MapPin, Phone, Store, Briefcase, UserRound } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { normalizePhone } from '../../lib/identity'
import CitySelect from '../CitySelect'
import { Skeleton, Spinner } from '../ui'
import { cn } from '../../lib/format'
import type { Address } from '../../lib/types'

const MapPicker = lazy(() => import('./MapPicker'))

type GeoState = 'idle' | 'locating' | 'denied' | 'unavailable'

/** Add or edit a delivery location: label, contact name, phone, city, nearest landmark and a GPS pin. */
export default function AddressForm({ address, onSaved, onClose }: { address?: Address | null; onSaved: (a: Address) => void; onClose: () => void }) {
  const { t } = usePrefs()
  const { session, profile } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({
    label: address?.label ?? '',
    contact_name: address?.contact_name ?? profile?.full_name ?? '',
    phone: address?.phone ? `+${address.phone}` : profile?.phone ? `+${profile.phone}` : '',
    city: address?.city ?? profile?.city ?? '',
    details: address?.details ?? '',
    is_default: address?.is_default ?? false
  })
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(address?.lat != null && address?.lng != null ? { lat: address.lat, lng: address.lng } : null)
  const [geo, setGeo] = useState<GeoState>('idle')
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const presets = [
    { v: t('addrHome'), icon: Home },
    { v: t('addrShop'), icon: Store },
    { v: t('addrWork'), icon: Briefcase }
  ]

  function locate() {
    if (!('geolocation' in navigator)) { setGeo('unavailable'); return }
    setGeo('locating')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setAccuracy(Math.round(p.coords.accuracy)); setGeo('idle') },
      e => setGeo(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    if (!pos) { toast(t('addrPinRequired'), 'error'); return }
    setBusy(true)
    const row = {
      user_id: session.user.id, label: f.label.trim(), contact_name: f.contact_name.trim(), phone: normalizePhone(f.phone),
      city: f.city || null, details: f.details.trim() || null, lat: pos.lat, lng: pos.lng
    }
    try {
      // only one default address per member
      const { count } = await supabase.from('user_addresses').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id)
      const makeDefault = f.is_default || !count || (address?.is_default ?? false)
      if (makeDefault) await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', session.user.id).eq('is_default', true)
      const res = address
        ? await supabase.from('user_addresses').update({ ...row, is_default: makeDefault }).eq('id', address.id).select().single()
        : await supabase.from('user_addresses').insert({ ...row, is_default: makeDefault }).select().single()
      if (res.error) throw res.error
      toast(t('saved')); onSaved(res.data as Address); onClose()
    } catch (err) { toast((err as Error).message, 'error') }
    finally { setBusy(false) }
  }

  const icon = 'pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-2'
  return (
    <form onSubmit={save} className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><MapPin className="size-5" />{address ? t('editAddress') : t('newAddress')}</h2>

      {/* map + "use my location" */}
      <div className="overflow-hidden rounded-2xl border border-theme">
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <MapPicker value={pos} onChange={setPos} className="h-56 w-full" />
        </Suspense>
        <div className="flex items-center gap-2 border-t border-theme p-2">
          <button type="button" onClick={locate} disabled={geo === 'locating'} className="btn btn-primary min-h-11 flex-1 text-sm">
            {geo === 'locating' ? <Spinner /> : <Crosshair className="size-5" />}{t('useMyLocation')}
          </button>
        </div>
        <p className={cn('px-3 pb-2 text-[11px] leading-5', geo === 'denied' || geo === 'unavailable' ? 'text-rose-600' : 'text-2')}>
          {geo === 'denied' ? t('geoDenied') : geo === 'unavailable' ? t('geoUnavailable') : pos ? `${t('addrPinHint')}${accuracy ? ` · ±${accuracy}m` : ''}` : t('addrMapHint')}
        </p>
      </div>

      <div>
        <label className="label">{t('addrLabel')} *</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {presets.map(p => (
            <button key={p.v} type="button" onClick={() => setF({ ...f, label: p.v })} className={cn('filter-chip', f.label === p.v && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}><p.icon className="size-4" />{p.v}</button>
          ))}
        </div>
        <input required maxLength={60} className="field" placeholder={t('addrLabelPlaceholder')} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
      </div>
      <div className="grid gap-3 xs:grid-cols-2">
        <div className="relative"><UserRound className={icon} /><input required maxLength={80} className="field ps-12" placeholder={t('fullName')} aria-label={t('fullName')} value={f.contact_name} onChange={e => setF({ ...f, contact_name: e.target.value })} /></div>
        <div className="relative"><Phone className={icon} /><input required type="tel" dir="ltr" className="field px-12 text-start rtl:text-right" placeholder={t('phone')} aria-label={t('phone')} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <CitySelect withIcon value={f.city} onChange={city => setF({ ...f, city })} />
      <div className="relative">
        <Landmark className="pointer-events-none absolute start-4 top-4 size-5 text-2" />
        <textarea rows={2} maxLength={300} className="field resize-none ps-12" placeholder={t('nearestLandmark')} aria-label={t('nearestLandmark')} value={f.details} onChange={e => setF({ ...f, details: e.target.value })} />
      </div>
      <label className="flex min-h-11 items-center justify-between gap-2 rounded-2xl surface-2 px-4 text-sm font-bold">{t('addrDefault')}<input type="checkbox" className="size-5 accent-[var(--primary)]" checked={f.is_default} onChange={e => setF({ ...f, is_default: e.target.checked })} /></label>
      <button disabled={busy} className="btn btn-primary min-h-14 w-full text-base">{busy && <Spinner />}{t('saveAddress')}</button>
    </form>
  )
}
