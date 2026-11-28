import { lazy, Suspense } from 'react'
import { Landmark, MapPin, Navigation, Phone, UserRound } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { mapsLink } from '../../lib/data'
import { placeLabel } from '../../lib/iraq'
import { Skeleton } from '../ui'
import type { DeliverySnapshot } from '../../lib/types'

const MapPicker = lazy(() => import('./MapPicker'))

/** Where an order goes: label, contact, city + landmark, a small map and "open in Google Maps". */
export default function DeliveryCard({ d }: { d: DeliverySnapshot }) {
  const { t, lang } = usePrefs()
  const hasPin = d.lat != null && d.lng != null
  return (
    <section className="card overflow-hidden">
      <div className="space-y-1.5 p-4">
        <p className="label !mb-1 flex items-center gap-1.5"><MapPin className="size-3.5" />{t('deliveryLocation')} · <span className="text-[var(--text)]">{d.label}</span></p>
        <p className="flex items-center gap-2 text-sm"><UserRound className="size-4 text-2" />{d.name}</p>
        <p className="flex items-center gap-2 text-sm"><Phone className="size-4 text-2" /><a href={`tel:+${d.phone}`} className="font-bold" dir="ltr">+{d.phone}</a></p>
        {(d.city || d.details) && <p className="flex items-start gap-2 text-sm"><Landmark className="mt-1 size-4 shrink-0 text-2" /><span><b>{placeLabel(d.city, lang)}</b>{d.details && ` — ${d.details}`}</span></p>}
      </div>
      {hasPin && (
        <>
          <div className="no-print">
            <Suspense fallback={<Skeleton className="h-44 w-full rounded-none" />}>
              <MapPicker readOnly value={{ lat: d.lat!, lng: d.lng! }} className="h-44 w-full" />
            </Suspense>
          </div>
          <div className="no-print border-t border-theme p-3">
            <a href={mapsLink(d.lat!, d.lng!)} target="_blank" rel="noreferrer" className="btn btn-ghost min-h-11 w-full text-sm"><Navigation className="size-4" />{t('openInMaps')}</a>
          </div>
          <p className="hidden px-4 pb-3 text-xs print:block" dir="ltr">GPS: {d.lat!.toFixed(6)}, {d.lng!.toFixed(6)}</p>
        </>
      )}
    </section>
  )
}
