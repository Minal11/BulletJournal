import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/600.css'
import '@fontsource/architects-daughter/400.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import './index.css'
import App from './App.tsx'
import { getSupabase, isSupabaseConfigured } from './lib/supabase.ts'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js')
  })
}

void settleAuthRedirect().then((renderNow) => {
  if (!renderNow) return
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

async function settleAuthRedirect(): Promise<boolean> {
  const path = window.location.pathname
  if (!path.startsWith('/auth/') || !isSupabaseConfigured()) return true
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) await getSupabase().auth.exchangeCodeForSession(code)
  const destination = code && path.includes('reset') ? '/#/reset-password' : code ? '/#/' : '/#/sign-in'
  window.location.replace(`${window.location.origin}${destination}`)
  return false
}
