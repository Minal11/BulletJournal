import { useEffect, useRef, useState, type ReactNode } from 'react'
import { bareJournalPath, withDemoPrefix } from '../lib/demo-route.ts'
import { shouldApplyTypeShortcut } from '../lib/keyboard.ts'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { monthOf, quarterOf, todayISO } from '../domain/dates.ts'
import { journalSummary } from '../services/sync-diff.ts'
import { syncService } from '../services/syncService.ts'
import { applyAppearance } from '../state/appearance.ts'
import { useAuth } from '../state/auth.tsx'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { useSync } from '../state/use-sync.ts'
import { PullToSync } from './pull-to-sync.tsx'
import { SignOutButton } from './sign-out.tsx'
import { SyncChip } from './sync-status.tsx'
import { cls, PaperDialog } from './ui.tsx'

const TABS = [
  { id: 'index', label: 'Index', to: '/index' },
  { id: 'today', label: 'Today', to: '/' },
  { id: 'month', label: 'Monthly Log', to: 'month' },
  { id: 'future', label: 'Future Log', to: '/future' },
  { id: 'tasks', label: 'Master Tasks', to: '/tasks' },
  { id: 'goals', label: 'Goals', to: '/goals' },
  { id: 'habits', label: 'Habit Tracker', to: '/habits' },
  { id: 'collections', label: 'Collections', to: '/collections' },
  { id: 'reflections', label: 'Reflections', to: '/reflections' },
] as const

export function JournalRoot({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const sync = useSync()
  const { ready, error, snapshot } = useJournal()
  const userId = auth.user?.id
  useEffect(() => {
    if (!userId) return
    void journal.openForUser(userId)
    return () => {
      void journal.closeSession()
    }
  }, [userId])
  useEffect(() => {
    if (!ready) return
    applyAppearance(snapshot.settings)
    if (snapshot.settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyAppearance(snapshot.settings)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [ready, snapshot.settings])

  if (error && !ready) {
    return (
      <div className="boot">
        <p>{error}</p>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="boot">
        <p>Opening your journal…</p>
      </div>
    )
  }
  const found = sync.migration ? journalSummary(sync.migration) : null
  return (
    <>
      {children}
      <PaperDialog
        open={Boolean(found)}
        title="We found an existing local journal."
        confirmLabel="Import my journal"
        dismissLabel="Not now"
        onClose={() => syncService.dismissMigration()}
        onConfirm={() => {
          if (sync.migration) void journal.importAnonymous(sync.migration)
        }}
      >
        {found && (
          <>
            <p>
              {found.entries} daily entries · {found.goals} goals · {found.collections} collections · {found.reflections} monthly reflections
            </p>
            <p>Add this journal to your account? It stays on this device either way.</p>
          </>
        )}
      </PaperDialog>
    </>
  )
}

export function DemoRoot() {
  const { ready, error, snapshot } = useJournal()
  useEffect(() => {
    void journal.openDemo()
    return () => {
      void journal.closeSession()
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    applyAppearance(snapshot.settings)
  }, [ready, snapshot.settings])
  if (error && !ready) {
    return (
      <div className="boot">
        <p>{error}</p>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="boot">
        <p>Opening your journal…</p>
      </div>
    )
  }
  return <Outlet />
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { error } = useJournal()
  const auth = useAuth()
  const sheetRef = useRef<HTMLDivElement>(null)
  const demo = location.pathname === '/demo' || location.pathname.startsWith('/demo/')

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (shouldApplyTypeShortcut(event, event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (location.pathname !== '/' && !location.pathname.startsWith('/day/')) {
          navigate('/')
          window.setTimeout(() => document.dispatchEvent(new Event('bj-compose')), 40)
        } else {
          document.dispatchEvent(new Event('bj-compose'))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location.pathname, navigate])

  return (
    <div className="desk">
      <a className="skip" href="#journal-page">
        Skip to the page
      </a>
      <div className="journal-book">
        <nav className="bookmarks" aria-label="Journal sections">
          <BookmarkList />
          <div className="bookmark-foot">
            <p>Quarter = direction</p>
            <p>Month = focus</p>
            <p>Day = action + reality</p>
          </div>
          <div className="utility-links">
            <NavLink to={withDemoPrefix(location.pathname, '/search')}>Search</NavLink>
            <NavLink to={withDemoPrefix(location.pathname, '/settings')}>Settings</NavLink>
            {!demo && <SyncChip />}
            {!demo && auth.user?.email && <p className="signed-in">{auth.user.email}</p>}
            {!demo && <SignOutButton />}
          </div>
        </nav>
        <div className="sheet" ref={sheetRef}>
          <div className="mobile-bar">
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-index">
              Index
            </button>
            <div className="mobile-bar-end">
              {!demo && <SignOutButton />}
              {!demo && <SyncChip />}
            </div>
          </div>
          {error && <p className="save-error">{error}</p>}
          <PullToSync scrollerRef={sheetRef} />
          <div id="journal-page">
            <Outlet />
          </div>
        </div>
      </div>
      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <nav id="mobile-index" className="drawer" aria-label="Journal sections" onClick={(event) => event.stopPropagation()}>
            <p className="drawer-title">Index</p>
            <BookmarkList />
            <div className="utility-links">
              <NavLink to={withDemoPrefix(location.pathname, '/search')}>Search</NavLink>
              <NavLink to={withDemoPrefix(location.pathname, '/settings')}>Settings</NavLink>
              {!demo && auth.user?.email && <p className="signed-in">{auth.user.email}</p>}
              {!demo && <SignOutButton />}
            </div>
            <p className="whisper drawer-principle">Capture everything. Commit to very little.</p>
          </nav>
        </div>
      )}
    </div>
  )
}

function BookmarkList() {
  const today = todayISO()
  const { year, month } = monthOf(today)
  const quarter = quarterOf(year, month)
  const location = useLocation()
  const path = bareJournalPath(location.pathname)
  return (
    <ul>
      {TABS.map((tab) => {
        const target = tab.to === 'month' ? `/month/${year}/${month}` : tab.id === 'goals' ? `/goals/${quarter.year}/${quarter.quarter}` : tab.to
        const to = withDemoPrefix(location.pathname, target)
        const active =
          tab.id === 'today'
            ? path === '/' || path.startsWith('/day/')
            : tab.id === 'month'
              ? path.startsWith('/month')
              : tab.id === 'goals'
                ? path.startsWith('/goals')
                : tab.id === 'collections'
                  ? path.startsWith('/collections')
                  : tab.id === 'reflections'
                    ? path.startsWith('/reflection') || path.startsWith('/review')
                    : path === target
        return (
          <li key={tab.id}>
            <NavLink to={to} end={tab.id === 'today'} className={() => cls('bookmark', active && 'active')} data-tab={tab.id}>
              {tab.label}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
