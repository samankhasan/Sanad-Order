import { Briefcase, Home, MapPin, Store } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { placeLabel } from '../../lib/iraq'
import type { Address } from '../../lib/types'

export function AddressIcon({ label, className }: { label: string; className?: string }) {
  const { t } = usePrefs()
  const I = label === t('addrHome') ? Home : label === t('addrShop') ? Store : label === t('addrWork') ? Briefcase : MapPin
  return <I className={className} />
}

/** One line summary of a saved address */
export function AddressSummary({ a }: { a: Pick<Address, 'label' | 'contact_name' | 'phone' | 'city' | 'details'> }) {
  const { lang } = usePrefs()
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-extrabold">{a.label}</span>
      <span className="block truncate text-xs text-2">{a.contact_name} · <bdi dir="ltr">+{a.phone}</bdi></span>
      <span className="block truncate text-xs text-2">{[placeLabel(a.city, lang), a.details].filter(Boolean).join(' — ')}</span>
    </span>
  )
}
