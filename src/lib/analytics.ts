// Anonymous visitor counting: one random id per device, one row per device per day (server side).
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

function deviceId() {
  try {
    let id = localStorage.getItem('so.device')
    if (!id) { id = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem('so.device', id) }
    return id
  } catch { return 'nostorage' + Math.random().toString(36).slice(2, 12) }
}

let last = ''
/** Call on app start and whenever the signed-in user changes. */
export function trackVisit(userId: string | null) {
  const key = `${userId ?? 'guest'}:${new Date().toDateString()}`
  if (key === last) return
  last = key
  const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'
  supabase.rpc('track_visit', { p_device: deviceId(), p_platform: platform }).then(() => {}, () => {})
}
