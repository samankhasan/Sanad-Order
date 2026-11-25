// Native (Android / iOS) integration: safe-area insets, status bar, back button, haptics, splash.
import { Capacitor } from '@capacitor/core'

export const isNativeApp = Capacitor.isNativePlatform()

function applyInsets(insets: { top: number; bottom: number; left: number; right: number }) {
  const r = document.documentElement.style
  r.setProperty('--safe-area-inset-top', `${insets.top}px`)
  r.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`)
  r.setProperty('--safe-area-inset-left', `${insets.left}px`)
  r.setProperty('--safe-area-inset-right', `${insets.right}px`)
}

export async function initNative() {
  if (!isNativeApp) return
  document.documentElement.classList.add('native')
  try {
    const { SafeArea } = await import('capacitor-plugin-safe-area')
    const { insets } = await SafeArea.getSafeAreaInsets()
    applyInsets(insets)
    SafeArea.addListener('safeAreaChanged', d => applyInsets(d.insets))
  } catch (e) { console.warn('safe-area', e) }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }), 150)
  } catch { /* ignore */ }
}

// ---- Android back button: closes the top sheet first, then goes back, then exits ----
const backStack: (() => void)[] = []
export function pushBackHandler(fn: () => void) {
  backStack.push(fn)
  return () => { const i = backStack.lastIndexOf(fn); if (i >= 0) backStack.splice(i, 1) }
}

export async function initBackButton(isRoot: () => boolean, goBack: () => void) {
  if (!isNativeApp) return () => {}
  const { App } = await import('@capacitor/app')
  const h = await App.addListener('backButton', () => {
    const top = backStack[backStack.length - 1]
    if (top) { top(); return }
    if (isRoot()) App.minimizeApp()
    else goBack()
  })
  return () => h.remove()
}

export async function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  if (!isNativeApp) { try { navigator.vibrate?.(kind === 'success' ? [10, 40, 10] : 8) } catch { /* ignore */ } return }
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
    else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
  } catch { /* ignore */ }
}

// Per-page status-bar icon colour: 'light' icons over dark headers, 'dark' icons over white headers.
let themeDark = false
let override: 'light' | 'dark' | null = null
async function applyStatusBar() {
  if (!isNativeApp) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const lightIcons = override ? override === 'light' : themeDark
    await StatusBar.setStyle({ style: lightIcons ? Style.Dark : Style.Light })
  } catch { /* ignore */ }
}
export function setThemeForStatusBar(dark: boolean) { themeDark = dark; applyStatusBar() }
export function setStatusBarOverride(v: 'light' | 'dark' | null) { override = v; applyStatusBar() }

/** Direct download of the latest signed Android app (GitHub Release asset). */
export const ANDROID_APK_URL = 'https://github.com/samankhasan/Sanad-Order/releases/latest/download/SanadOrder.apk'
