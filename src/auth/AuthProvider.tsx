import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getMyProfile, type Profile } from '@/lib/api/team'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  hasAccess: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // id del usuario cuyo perfil ya se cargó (evita mostrar "sin acceso" mientras carga)
  const [profileFor, setProfileFor] = useState<string | null>(null)

  async function loadProfile(s: Session | null) {
    if (!s) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    try {
      setProfile(await getMyProfile(s.user.id))
    } catch {
      setProfile(null)
    } finally {
      setProfileFor(s.user.id)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Diferido para no bloquear el callback de Supabase
      setTimeout(() => loadProfile(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    session,
    profile,
    loading: loading || Boolean(session && profileFor !== session.user.id),
    isAdmin: profile?.role === 'admin',
    hasAccess: Boolean(profile?.role),
    async signIn(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signOut() {
      await supabase!.auth.signOut()
    },
    async sendPasswordReset(email) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/restablecer`,
      })
      if (error) throw error
    },
    async refreshProfile() {
      await loadProfile(session)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
