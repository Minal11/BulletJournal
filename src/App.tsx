import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { canOpenJournal, routeForGuest } from './lib/sign-out.ts'
import { AppShell, DemoRoot, JournalRoot } from './components/shell.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { CollectionPage } from './pages/CollectionPage.tsx'
import { CollectionsPage } from './pages/CollectionsPage.tsx'
import { FutureLogPage } from './pages/FutureLogPage.tsx'
import { GoalsPage, GoalsRedirect } from './pages/GoalsPage.tsx'
import { IndexPage } from './pages/IndexPage.tsx'
import { MonthlyLogPage } from './pages/MonthlyLogPage.tsx'
import { MonthlyReflectionPage } from './pages/MonthlyReflectionPage.tsx'
import { QuarterlyReviewPage } from './pages/QuarterlyReviewPage.tsx'
import { ReflectionsPage } from './pages/ReflectionsPage.tsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx'
import { SearchPage } from './pages/SearchPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { TodayPage } from './pages/TodayPage.tsx'
import { AuthProvider, useAuth } from './state/auth.tsx'

function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (!auth.configured) return <AuthPage />
  if (auth.loading) {
    return (
      <div className="boot">
        <p>Opening your journal…</p>
      </div>
    )
  }
  if (!canOpenJournal(auth.user?.id)) return <Navigate to={routeForGuest(location.pathname)} replace />
  return <Outlet />
}

function ProtectedJournal() {
  return (
    <JournalRoot>
      <AppShell />
    </JournalRoot>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="sign-in" element={<AuthPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          {import.meta.env.DEV && (
            <Route path="demo" element={<DemoRoot />}>
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="day/:date" element={<TodayPage />} />
                <Route path="month/:year/:month" element={<MonthlyLogPage />} />
                <Route path="future" element={<FutureLogPage />} />
                <Route path="goals" element={<GoalsRedirect />} />
                <Route path="goals/:year/:quarter" element={<GoalsPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="collections/:id" element={<CollectionPage />} />
                <Route path="reflections" element={<ReflectionsPage />} />
                <Route path="reflection/:year/:month" element={<MonthlyReflectionPage />} />
                <Route path="review/:year/:quarter" element={<QuarterlyReviewPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="index" element={<IndexPage />} />
              </Route>
            </Route>
          )}
          <Route element={<RequireAuth />}>
            <Route element={<ProtectedJournal />}>
              <Route index element={<TodayPage />} />
              <Route path="day/:date" element={<TodayPage />} />
              <Route path="month/:year/:month" element={<MonthlyLogPage />} />
              <Route path="future" element={<FutureLogPage />} />
              <Route path="goals" element={<GoalsRedirect />} />
              <Route path="goals/:year/:quarter" element={<GoalsPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="collections/:id" element={<CollectionPage />} />
              <Route path="reflections" element={<ReflectionsPage />} />
              <Route path="reflection/:year/:month" element={<MonthlyReflectionPage />} />
              <Route path="review/:year/:quarter" element={<QuarterlyReviewPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="index" element={<IndexPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
