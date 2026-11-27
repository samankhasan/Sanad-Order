import { useEffect, useState } from 'react'
import { Download, FileText, MonitorSmartphone, Moon, Smartphone, Sun } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { ANDROID_APK_URL, isNativeApp } from '../../lib/native'
import { PageHeader } from '../../components/ui'
import { LANGS } from '../../lib/i18n'
import { assetUrl, cn } from '../../lib/format'
import { COMPANY_WEBSITE } from '../../lib/contact'

interface BIPEvent extends Event { prompt: () => Promise<void> }
let deferredPrompt: BIPEvent | null = null
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e as BIPEvent })

/** Account → Language & appearance, plus "About the app". */
export default function Settings() {
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)
  useEffect(() => {
    const h = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', h)
    if (window.location.hash.includes('#about')) document.getElementById('about')?.scrollIntoView()
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

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

        {canInstall && (
          <button onClick={async () => { await deferredPrompt?.prompt(); deferredPrompt = null; setCanInstall(false) }} className="btn btn-ghost w-full">
            <Download className="size-5" />{t('install')}
          </button>
        )}
        {!isNativeApp && <a href={ANDROID_APK_URL} className="btn btn-ghost w-full"><Smartphone className="size-5 text-s-green" />{t('getAndroidApp')}</a>}

        <section id="about" className="card flex flex-col items-center gap-2 p-6 text-center">
          <img src={assetUrl('icons/icon-192.png')} alt="" className="size-16 rounded-[18px] shadow" />
          <p className="text-lg font-black">Sanad Order</p>
          <p className="text-xs text-2">{t('version')} <bdi dir="ltr">{__APP_VERSION__}</bdi></p>
          <a href={COMPANY_WEBSITE} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand" dir="ltr">www.sanadcompany.com</a>
          <a href="./privacy.html" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-2"><FileText className="size-4" />{t('privacy')}</a>
          <p className="mt-2 text-[11px] text-2" dir="ltr">Sanad Company © 2026</p>
        </section>
      </div>
    </div>
  )
}
