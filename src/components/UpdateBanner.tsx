import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { RefreshCw, X } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'

const DISMISS_KEY = 'so.updateDismissed'
const RELEASES = 'https://api.github.com/repos/samankhasan/Sanad-Order/releases/latest'

/** "1.10.0" > "1.9.2" */
function newer(a: string, b: string) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0), pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

/** Which version is waiting, or null. Google Play first; the GitHub release only when Play cannot answer. */
async function availableUpdate(): Promise<string | null> {
  const current = (await App.getInfo()).version
  try {
    const info = await AppUpdate.getAppUpdateInfo()
    return info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE ? (info.availableVersionName || 'play') : null
  } catch {
    // not installed from Google Play (e.g. the APK): compare with the latest published release
    const r = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } })
    if (!r.ok) return null
    const tag = String((await r.json()).tag_name ?? '').replace(/^v/, '').split('-')[0]
    return tag && newer(tag, current) ? tag : null
  }
}

/** Android app: tells the member a new version exists, with a button that opens our page on Google Play.
 *  (The website updates itself, so nothing is shown there.) */
export default function UpdateBanner() {
  const { t } = usePrefs()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let live = true
    const check = () => availableUpdate().then(v => {
      let dismissed: string | null = null
      try { dismissed = sessionStorage.getItem(DISMISS_KEY) } catch { /* ignore */ }
      if (live) setVersion(v && v !== dismissed ? v : null)
    }, () => {})
    check()
    // check again whenever the app comes back to the front
    const sub = App.addListener('resume', check)
    return () => { live = false; sub.then(h => h.remove()) }
  }, [])

  if (!version) return null
  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, version) } catch { /* ignore */ } setVersion(null) }
  return (
    <section className="rise card relative flex items-center gap-3 overflow-hidden p-4 ring-2 ring-emerald-500/30">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-md"><RefreshCw className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-snug">{t('updateAvailable')}</p>
        <p className="mt-0.5 text-xs text-2">{t('updateHint')}{/^\d/.test(version) && <span dir="ltr"> · v{version}</span>}</p>
      </div>
      <button onClick={() => AppUpdate.openAppStore().catch(() => {})} className="btn min-h-11 shrink-0 bg-emerald-600 px-4 text-sm text-white">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M3.6 1.8 13.3 12l-9.7 10.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Zm11 11.6 2.5 2.6-11.4 6.5 8.9-9.1Zm3.9-4.1 2.4 1.4c.8.4.8 1.6 0 2.1l-2.4 1.4-2.8-2.8 2.8-2.1ZM5.7 1.5l11.4 6.5-2.5 2.6-8.9-9.1Z" /></svg>
        {t('updateNow')}
      </button>
      <button onClick={dismiss} aria-label={t('later')} className="absolute end-1 top-1 grid size-8 place-items-center rounded-full text-2"><X className="size-4" /></button>
    </section>
  )
}
