import { useEffect, useState } from 'react'
import { CheckCircle2, Download, MonitorSmartphone, Smartphone } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { ANDROID_APK_URL, isNativeApp } from '../../lib/native'
import { PageHeader } from '../../components/ui'
import { assetUrl } from '../../lib/format'

interface BIPEvent extends Event { prompt: () => Promise<void> }
let deferred: BIPEvent | null = null
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent })

const AppleLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d="M16.37 12.2c-.02-2.13 1.74-3.15 1.82-3.2-.99-1.45-2.54-1.65-3.09-1.67-1.32-.13-2.57.77-3.24.77-.67 0-1.7-.75-2.79-.73-1.44.02-2.76.83-3.5 2.12-1.49 2.59-.38 6.42 1.07 8.52.71 1.03 1.55 2.18 2.66 2.14 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.88-1.04 2.58-2.07.81-1.19 1.15-2.34 1.17-2.4-.03-.01-2.24-.86-2.26-3.41ZM14.24 5.94c.59-.71.99-1.7.88-2.69-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.64-.9 2.61.95.07 1.92-.48 2.51-1.2Z" /></svg>
)
const AndroidLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d="M17.6 9.48 19.44 6.3a.38.38 0 0 0-.66-.38l-1.86 3.23a11.43 11.43 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52ZM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25Zm10 0a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 17 15.25Z" /></svg>
)

/** Account → Install the app: Android (APK now, Google Play later) and iOS (coming soon). */
export default function InstallApp() {
  const { t } = usePrefs()
  const [canPwa, setCanPwa] = useState(!!deferred)
  useEffect(() => {
    const h = () => setCanPwa(true)
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  return (
    <div>
      <PageHeader back="/account" title={t('installApp')} />
      <div className="page-narrow px-g space-y-4 pb-8">
        <section className="flex flex-col items-center gap-2 py-4 text-center">
          <img src={assetUrl('icons/icon-192.png')} alt="" className="size-20 rounded-[22px] shadow-lg" />
          <h2 className="text-lg font-black">Sanad Order</h2>
          <p className="max-w-xs text-sm leading-7 text-2">{t('installLead')}</p>
        </section>

        {/* Android */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-theme p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#3ddc84] text-white shadow-md"><AndroidLogo className="size-7" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">Android</p>
              <p className="text-xs text-2">{t('installAndroidHint')}</p>
            </div>
            {isNativeApp && <span className="chip shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-3.5" />{t('installed')}</span>}
          </div>
          <div className="space-y-2 p-4">
            {isNativeApp
              ? <p className="text-center text-sm text-2">{t('installedHint')} <bdi dir="ltr">v{__APP_VERSION__}</bdi></p>
              : <a href={ANDROID_APK_URL} className="btn min-h-14 w-full bg-[#0b1220] text-base text-white dark:bg-white dark:text-[#0b1220]"><Download className="size-5" />{t('downloadApk')}</a>}
            <ol className="space-y-1.5 pt-1 text-xs leading-6 text-2">
              {[t('installStep1'), t('installStep2'), t('installStep3')].map((s, i) => (
                <li key={i} className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full surface-2 text-[10px] font-black" dir="ltr">{i + 1}</span>{s}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* iOS — not available yet */}
        <section className="card overflow-hidden opacity-80">
          <div className="flex items-center gap-3 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#0b1220] text-white shadow-md dark:bg-white dark:text-[#0b1220]"><AppleLogo className="size-7" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">iPhone · iOS</p>
              <p className="text-xs text-2">{t('iosSoonHint')}</p>
            </div>
            <span className="chip shrink-0 surface-2">{t('ch_upcoming')}</span>
          </div>
          <div className="px-4 pb-4"><button disabled className="btn btn-ghost min-h-12 w-full opacity-60"><Smartphone className="size-5" />App Store</button></div>
        </section>

        {canPwa && !isNativeApp && (
          <button onClick={async () => { await deferred?.prompt(); deferred = null; setCanPwa(false) }} className="btn btn-ghost w-full"><MonitorSmartphone className="size-5" />{t('install')}</button>
        )}
      </div>
    </div>
  )
}
