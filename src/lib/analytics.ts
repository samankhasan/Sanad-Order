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

/** Visitor's country code (e.g. IQ). Cached per device for a day; never blocks the visit. */
async function country(): Promise<string | null> {
  try {
    const c = JSON.parse(localStorage.getItem('so.country') || 'null') as { v: string; t: number } | null
    if (c && Date.now() - c.t < 864e5) return c.v
  } catch { /* ignore */ }
  const sources: [string, (j: Record<string, unknown>) => unknown][] = [
    ['https://api.country.is/', j => j.country],
    ['https://get.geojs.io/v1/ip/country.json', j => j.country]
  ]
  for (const [url, pick] of sources) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!r.ok) continue
      const v = String(pick(await r.json()) ?? '').toUpperCase()
      if (/^[A-Z]{2}$/.test(v)) {
        try { localStorage.setItem('so.country', JSON.stringify({ v, t: Date.now() })) } catch { /* ignore */ }
        return v
      }
    } catch { /* try next */ }
  }
  return null
}

let last = ''
/** Call on app start and whenever the signed-in user changes. */
export function trackVisit(userId: string | null) {
  const key = `${userId ?? 'guest'}:${new Date().toDateString()}`
  if (key === last) return
  last = key
  const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'
  country().then(c => supabase.rpc('track_visit', { p_device: deviceId(), p_platform: platform, p_country: c }))
    .then(() => {}, () => {})
}
