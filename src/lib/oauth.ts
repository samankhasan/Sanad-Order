// "Continue with Google" for the website and the Android/iOS app.
// Web: normal redirect back to the site (tokens arrive in the URL hash, handled in AuthContext).
// App: Google opens in the system browser and returns through the deep link
//      com.sanadcompany.sanadorder://login-callback (see AndroidManifest patch in CI).
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

export const NATIVE_REDIRECT = 'com.sanadcompany.sanadorder://login-callback'

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } }
    })
    if (error) throw error
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: data.url, presentationStyle: 'popover' })
    return
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } }
  })
  if (error) throw error
}

/** Deep link from the browser back into the app: finish the Google sign-in. */
export async function handleAuthDeepLink(url: string) {
  if (!url.startsWith(NATIVE_REDIRECT)) return false
  const frag = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? ''
  const p = new URLSearchParams(frag)
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.close().catch(() => {})
  } catch { /* ignore */ }
  if (p.get('access_token') && p.get('refresh_token')) {
    await supabase.auth.setSession({ access_token: p.get('access_token')!, refresh_token: p.get('refresh_token')! })
  } else if (p.get('code')) {
    await supabase.auth.exchangeCodeForSession(p.get('code')!)
  }
  return true
}
