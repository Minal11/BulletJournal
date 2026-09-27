import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authRedirect, getSupabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase.ts'

interface AuthValue {
  configured: boolean
  configError: string | null
  loading: boolean
  user: User | null
  session: Session | null
  displayName: string
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  updateDisplayName: (name: string) => Promise<string | null>
  deleteAccount: () => Promise<string | null>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabase()
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      if (data.session) void loadProfile(data.session.user.id, setDisplayName)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
      if (next) void loadProfile(next.user.id, setDisplayName)
      else setDisplayName('')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [configured])

  const value = useMemo<AuthValue>(
    () => ({
      configured,
      configError: configured ? null : supabaseConfigError(),
      loading,
      user: session?.user ?? null,
      session,
      displayName,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
        return error?.message ?? null
      },
      async signUp(email, password) {
        const { data, error } = await getSupabase().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirect('/auth/callback'), data: { display_name: email.trim().split('@')[0] } },
        })
        if (error) return error.message
        if (!data.session) return 'Check your email to open the journal.'
        return null
      },
      async signOut() {
        await getSupabase().auth.signOut()
      },
      async resetPassword(email) {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('/auth/reset') })
        return error?.message ?? null
      },
      async updatePassword(password) {
        const { error } = await getSupabase().auth.updateUser({ password })
        return error?.message ?? null
      },
      async updateDisplayName(name) {
        const user = session?.user
        if (!user) return 'Sign in first.'
        const trimmed = name.trim()
        const { error } = await getSupabase().from('profiles').update({ display_name: trimmed, updated_at: new Date().toISOString() }).eq('id', user.id)
        if (error) return error.message
        setDisplayName(trimmed)
        return null
      },
      async deleteAccount() {
        const { error } = await getSupabase().rpc('delete_own_account')
        if (error) return error.message
        await getSupabase().auth.signOut()
        return null
      },
    }),
    [configured, displayName, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function loadProfile(userId: string, setDisplayName: (name: string) => void) {
  const { data } = await getSupabase().from('profiles').select('display_name').eq('id', userId).maybeSingle()
  if (data && typeof data.display_name === 'string') setDisplayName(data.display_name)
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth is not ready.')
  return value
}
