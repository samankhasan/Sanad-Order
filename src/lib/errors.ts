import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { deviceId } from './analytics'

/** Crash / error reporting to our own database (Admin → Errors). Same error once per session, at most 15 per session. */
const sent = new Set<string>()
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i, /The user aborted a request/i, /Load failed$/i, /NetworkError when attempting to fetch/i, /Failed to fetch$/i]

export function reportError(err: unknown, extra?: string) {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
    const message = (e.message || String(err)).slice(0, 500)
    if (IGNORE.some(r => r.test(message))) return
    const key = message + (e.stack?.split('\n')[1] ?? '')
    if (sent.has(key) || sent.size >= 15) return
    sent.add(key)
    const stack = [e.stack, extra].filter(Boolean).join('\n--\n').slice(0, 4000)
    supabase.rpc('log_client_error', {
      p_message: message,
      p_stack: stack || null,
      p_url: location.hash || location.pathname,
      p_version: __APP_VERSION__,
      p_platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web',
      p_user_agent: navigator.userAgent.slice(0, 300),
      p_device: deviceId()
    }).then(() => {}, () => {})
  } catch { /* never let reporting break the app */ }
}

/** A new version was deployed while the app was open → old code-split files are gone: reload once to get the new ones. */
function isStaleChunk(message: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(message)
}
export function reloadForStaleChunk(message: string) {
  if (!isStaleChunk(message)) return false
  try {
    if (sessionStorage.getItem('so.chunkReload')) return false
    sessionStorage.setItem('so.chunkReload', '1')
  } catch { return false }
  location.reload()
  return true
}

export function installErrorReporting() {
  window.addEventListener('error', ev => {
    const msg = ev.error?.message ?? ev.message ?? ''
    if (reloadForStaleChunk(msg)) return
    reportError(ev.error ?? msg, ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined)
  })
  window.addEventListener('unhandledrejection', ev => {
    const msg = ev.reason?.message ?? String(ev.reason ?? '')
    if (reloadForStaleChunk(msg)) return
    reportError(ev.reason ?? 'Unhandled promise rejection')
  })
  // a successful start clears the "already reloaded once" flag
  setTimeout(() => { try { sessionStorage.removeItem('so.chunkReload') } catch { /* ignore */ } }, 10000)
}
