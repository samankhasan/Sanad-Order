// Push registration for Android (Capacitor + FCM) and the web (Firebase Messaging).
// Every part is optional: if Firebase isn't configured the in-app inbox still works via Supabase Realtime.
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

const env = import.meta.env
export const webPushConfigured = !!(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_APP_ID && env.VITE_FIREBASE_VAPID_KEY)
export const nativePushConfigured = env.VITE_NATIVE_PUSH === '1'
export const isNative = Capacitor.isNativePlatform()

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

async function saveToken(token: string, platform: 'android' | 'ios' | 'web') {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await supabase.from('push_tokens').upsert({ token, user_id: data.user.id, platform, updated_at: new Date().toISOString() })
  try { localStorage.setItem('so.pushToken', token) } catch { /* ignore */ }
}

export async function removeMyToken() {
  try {
    const t = localStorage.getItem('so.pushToken')
    if (t) await supabase.from('push_tokens').delete().eq('token', t)
    localStorage.removeItem('so.pushToken')
  } catch { /* ignore */ }
}

export function pushState(): PushState {
  if (isNative) return nativePushConfigured ? 'default' : 'unsupported'
  if (!webPushConfigured || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission as PushState
}

/** Ask permission + register. `navigate` is used when the user taps a notification. */
export async function enablePush(navigate: (path: string) => void): Promise<PushState> {
  if (isNative) {
    if (!nativePushConfigured) return 'unsupported'
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return 'denied'
    await PushNotifications.createChannel({ id: 'sanad_default', name: 'Sanad Order', importance: 5, sound: 'default', vibration: true, visibility: 1 }).catch(() => {})
    await PushNotifications.removeAllListeners()
    await PushNotifications.addListener('registration', t => saveToken(t.value, Capacitor.getPlatform() as 'android' | 'ios'))
    await PushNotifications.addListener('pushNotificationActionPerformed', a => {
      const link = a.notification.data?.link
      navigate(link || '/notifications')
    })
    await PushNotifications.register()
    return 'granted'
  }

  if (!webPushConfigured) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm as PushState
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: `${env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: env.VITE_FIREBASE_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  }
  const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage }] = await Promise.all([import('firebase/app'), import('firebase/messaging')])
  const app = getApps()[0] ?? initializeApp(cfg)
  const swUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(cfg))}`
  const reg = await navigator.serviceWorker.register(swUrl, { scope: `${import.meta.env.BASE_URL}firebase-cloud-messaging-push-scope` })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey: env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg })
  if (token) await saveToken(token, 'web')
  // foreground messages are shown by the in-app realtime inbox, so nothing else to do here
  onMessage(messaging, () => {})
  return 'granted'
}

/** Silently re-register on app start if permission was already given. */
export async function refreshPush(navigate: (path: string) => void) {
  try {
    if (isNative && nativePushConfigured) {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const p = await PushNotifications.checkPermissions()
      if (p.receive === 'granted') await enablePush(navigate)
    } else if (!isNative && webPushConfigured && 'Notification' in window && Notification.permission === 'granted') {
      await enablePush(navigate)
    }
  } catch (e) { console.warn('push refresh failed', e) }
}

/** Fire-and-forget call to the send-push edge function. */
export function notify(body: Record<string, unknown>) {
  return supabase.functions.invoke('send-push', { body }).catch(e => console.warn('send-push', e))
}
