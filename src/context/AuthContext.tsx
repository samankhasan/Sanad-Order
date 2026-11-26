import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { trackVisit } from '../lib/analytics'

interface Auth {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  /** true after opening a password-reset link: the app asks for a new password */
  recovery: boolean
  endRecovery: () => void
}

const Ctx = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    // Password-reset link from the e-mail: tokens arrive in the URL (hash or ?code=)
    const consumeRecoveryLink = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''))
      const query = new URLSearchParams(window.location.search)
      const clean = () => window.history.replaceState(null, '', window.location.pathname + '#/')
      if (hash.get('access_token') && hash.get('refresh_token')) {
        await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! })
        if (hash.get('type') === 'recovery') setRecovery(true)
        clean()
      } else if (query.get('code')) {
        await supabase.auth.exchangeCodeForSession(query.get('code')!) // recovery is flagged by the PASSWORD_RECOVERY event
        clean()
      } else if (hash.get('error_description') || query.get('error_description')) {
        try { sessionStorage.setItem('so.authError', (hash.get('error_description') || query.get('error_description'))!.replace(/\+/g, ' ')) } catch { /* ignore */ }
        clean()
      }
    }
    consumeRecoveryLink().catch(() => {}).finally(() => supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      trackVisit(data.session?.user.id ?? null)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    }))
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      setTimeout(() => trackVisit(s?.user.id ?? null), 0)
      // defer: never await supabase calls inside this callback
      setTimeout(() => loadProfile(s?.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value: Auth = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => { await supabase.auth.signOut() },
    recovery,
    endRecovery: () => setRecovery(false)
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
