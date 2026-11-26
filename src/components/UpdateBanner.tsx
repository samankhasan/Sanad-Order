import { useEffect, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { ANDROID_APK_URL, pushBackHandler } from '../lib/native'
import { App } from '@capacitor/app'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { Download, RefreshCw } from 'lucide-react'
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

/** Android app: a dialog in the middle of the screen tells the member a new version exists, with a button that takes them to it
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

  const dismissRef = useRef(() => {})
  // Android back button = "Later"; the page behind does not scroll while the dialog is open
  useEffect(() => {
    if (!update) return
    const off = pushBackHandler(() => dismissRef.current())
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { off(); document.body.style.overflow = prev }
  }, [update])

  if (!update) return null
  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, update.version ?? update.via) } catch { /* ignore */ } setUpdate(null) }
  dismissRef.current = dismiss
  const open = () => update.via === 'play'
    ? AppUpdate.openAppStore().catch(() => {})
    : Browser.open({ url: ANDROID_APK_URL }).catch(() => { window.open(ANDROID_APK_URL, '_blank') })
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="update-title">
      <div className="fade-in absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={dismiss} />
      <section className="rise relative w-full max-w-sm overflow-hidden rounded-[28px] surface text-center shadow-2xl">
        <div className="h-1.5 sanad-stripe" />
        <div className="px-6 pb-6 pt-7">
          <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><RefreshCw className="size-8" /></span>
          <h2 id="update-title" className="mt-4 text-lg font-black leading-snug">{t('updateAvailable')}</h2>
          <p className="mt-2 text-sm leading-7 text-2">{t('updateHint')}</p>
          {update.version && <p className="mt-2 inline-flex rounded-full surface-2 px-3 py-1 text-xs font-bold" dir="ltr">v{update.version}</p>}
          <div className="mt-6 space-y-2">
            <button onClick={open} className="btn min-h-13 w-full bg-emerald-600 text-base text-white">
              {update.via === 'play' ? <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="currentColor" d="M3.6 1.8 13.3 12l-9.7 10.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Zm11 11.6 2.5 2.6-11.4 6.5 8.9-9.1Zm3.9-4.1 2.4 1.4c.8.4.8 1.6 0 2.1l-2.4 1.4-2.8-2.8 2.8-2.1ZM5.7 1.5l11.4 6.5-2.5 2.6-8.9-9.1Z" /></svg> : <Download className="size-5" />}
              {t('updateNow')}
            </button>
            <button onClick={dismiss} className="btn btn-ghost min-h-12 w-full">{t('later')}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
