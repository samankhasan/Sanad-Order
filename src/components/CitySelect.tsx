import { MapPin } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { IRAQ } from '../lib/iraq'
import { cn } from '../lib/format'

/** Native <select> grouped by governorate — fast, searchable by typing, and mobile-friendly. */
export default function CitySelect({ value, onChange, required, withIcon, className }: { value: string; onChange: (v: string) => void; required?: boolean; withIcon?: boolean; className?: string }) {
  const { t, lang } = usePrefs()
  return (
    <div className="relative">
      {withIcon && <MapPin className="pointer-events-none absolute start-4 top-1/2 z-10 size-5 -translate-y-1/2 text-2" />}
      <select
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={t('selectCity')}
        className={cn('field appearance-none', withIcon && 'ps-12', !value && 'text-[var(--text-2)]', className)}
      >
        <option value="" disabled>{t('chooseCity')}</option>
        {IRAQ.map(g => (
          <optgroup key={g.en} label={g[lang]}>
            {g.places.map(pl => <option key={g.en + pl.en} value={pl.en}>{pl[lang]}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
