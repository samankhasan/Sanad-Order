import { MonitorSmartphone, Moon, Sun } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { PageHeader } from '../../components/ui'
import { LANGS } from '../../lib/i18n'
import { cn } from '../../lib/format'

/** Account → Language & appearance (only that). */
export default function Settings() {
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  return (
    <div>
      <PageHeader back="/account" title={t('settings')} />
      <div className="page-narrow px-g space-y-4 pb-6">
        <section className="card space-y-4 p-5">
          <div>
            <p className="label">{t('language')}</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)} className={cn('btn py-3 text-sm', lang === l.code ? 'btn-primary' : 'btn-ghost')}>{l.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{t('theme')}</p>
            <div className="grid grid-cols-3 gap-2">
              {([['light', Sun], ['dark', Moon], ['system', MonitorSmartphone]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setTheme(k)} className={cn('btn py-3 text-sm', theme === k ? 'btn-primary' : 'btn-ghost')}><Icon className="size-4" />{t(k)}</button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
