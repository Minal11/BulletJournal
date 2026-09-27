import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey)
}

export function supabaseConfigError(): string {
  return 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.'
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error(supabaseConfigError())
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}

export function authRedirect(path: '/auth/callback' | '/auth/reset'): string {
  return `${window.location.origin}${path}`
}
