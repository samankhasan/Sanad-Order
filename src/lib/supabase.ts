import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

/**
 * Where the login session is kept, so users stay signed in until they sign out themselves.
 * - Android / iOS app: native Preferences (survives WebView storage being cleared)
 * - Browser / PWA: localStorage
 * The session refreshes itself; it only ends on "Sign out".
 */
const nativeStorage: SupportedStorage = {
  async getItem(k) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: k })
    if (value != null) return value
    // one-time move of a session saved by an older version in localStorage
    try {
      const old = localStorage.getItem(k)
      if (old != null) { await Preferences.set({ key: k, value: old }); return old }
    } catch { /* ignore */ }
    return null
  },
  async setItem(k, v) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: k, value: v })
    try { localStorage.setItem(k, v) } catch { /* ignore */ }
  },
  async removeItem(k) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key: k })
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  }
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: Capacitor.isNativePlatform() ? nativeStorage : undefined
  }
})

// Phones pause timers in the background: refresh the session as soon as the app comes back.
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })
  }).catch(() => {})
}

export const IMAGE_BUCKET = 'product-images'
