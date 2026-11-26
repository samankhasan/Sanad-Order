import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { ANDROID_APK_URL } from '../lib/native'
import { App } from '@capacitor/app'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { Download, RefreshCw, X } from 'lucide-react'
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

interface InstallSourcePlugin { get(): Promise<{ installer: string | null }> }
const InstallSource = registerPlugin<InstallSourcePlugin>('InstallSource')

type Update = { version: string | null; via: 'play' | 'apk' }

/** Is a newer version waiting, and where should this member get it?
 *  - installed from Google Play  → ask Google Play (in-app updates); the button opens our Play page
 *  - installed from the APK      → compare with the latest published release; the button downloads the new APK
 *    (an APK install can't be updated through Play, and Play may not have the new version yet) */
async function availableUpdate(): Promise<Update | null> {
  const current = (await App.getInfo()).version
  const installer = await InstallSource.get().then(r => r.installer, () => null)
  if (installer === 'com.android.vending') {
    const info = await AppUpdate.getAppUpdateInfo()
    return info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE ? { version: null, via: 'play' } : null
  }
  const r = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } })
  if (!r.ok) return null
  const tag = String((await r.json()).tag_name ?? '').replace(/^v/, '').split('-')[0]
  return tag && newer(tag, current) ? { version: tag, via: 'apk' } : null
}

/** Android app: tells the member a new version exists, with a button that takes them to it
 *  (Google Play for Play installs, the APK download otherwise). The website updates itself. */
export default function UpdateBanner() {
  const { t } = usePrefs()
  const [update, setUpdate] = useState<Update | null>(null)

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let live = true
    const check = () => availableUpdate().then(u => {
      let dismissed: string | null = null
      try { dismissed = sessionStorage.getItem(DISMISS_KEY) } catch { /* ignore */ }
      if (live) setUpdate(u && (u.version ?? u.via) !== dismissed ? u : null)
    }, () => {})
    check()
    // check again whenever the app comes back to the front
    const sub = App.addListener('resume', check)
    return () => { live = false; sub.then(h => h.remove()) }
  }, [])

  if (!update) return null
  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, update.version ?? update.via) } catch { /* ignore */ } setUpdate(null) }
  const open = () => update.via === 'play'
    ? AppUpdate.openAppStore().catch(() => {})
    : Browser.open({ url: ANDROID_APK_URL }).catch(() => { window.open(ANDROID_APK_URL, '_blank') })
  return (
    <section className="rise card relative flex items-center gap-3 overflow-hidden p-4 ring-2 ring-emerald-500/30">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-md"><RefreshCw className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-snug">{t('updateAvailable')}</p>
        <p className="mt-0.5 text-xs text-2">{t('updateHint')}{update.version && <bdi dir="ltr"> · v{update.version}</bdi>}</p>
      </div>
      <button onClick={open} className="btn min-h-11 shrink-0 bg-emerald-600 px-4 text-sm text-white">
        {update.via === 'play' ? <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M3.6 1.8 13.3 12l-9.7 10.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Zm11 11.6 2.5 2.6-11.4 6.5 8.9-9.1Zm3.9-4.1 2.4 1.4c.8.4.8 1.6 0 2.1l-2.4 1.4-2.8-2.8 2.8-2.1ZM5.7 1.5l11.4 6.5-2.5 2.6-8.9-9.1Z" /></svg> : <Download className="size-4" />}
        {t('updateNow')}
      </button>
      <button onClick={dismiss} aria-label={t('later')} className="absolute end-1 top-1 grid size-8 place-items-center rounded-full text-2"><X className="size-4" /></button>
    </section>
  )
}
