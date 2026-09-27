import { useEffect, useState } from 'react'
import { collectionToMarkdown, monthToMarkdown, reviewToMarkdown } from '../domain/markdown.ts'
import { migrateSnapshot } from '../domain/schema.ts'
import type { AppSettings, HandFont, PaperStyle } from '../domain/types.ts'
import { downloadText } from '../lib/download.ts'
import { databaseName } from '../services/sync-diff.ts'
import { syncService } from '../services/syncService.ts'
import { useAuth } from '../state/auth.tsx'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { useSync } from '../state/use-sync.ts'
import { deleteDatabase } from '../storage/db.ts'
import { Choice, PaperDialog } from '../components/ui.tsx'

export function SettingsPage() {
  const auth = useAuth()
  const sync = useSync()
  const { snapshot, backupAt } = useJournal()
  const settings = snapshot.settings
  const [importing, setImporting] = useState<ReturnType<typeof migrateSnapshot> | null>(null)
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState(auth.displayName)
  const [password, setPassword] = useState('')
  const [erase, setErase] = useState(false)
  const [eraseText, setEraseText] = useState('')
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setDisplayName(auth.displayName)
  }, [auth.displayName])

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    function onPrompt(event: Event) {
      event.preventDefault()
      setInstall(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    journal.updateSettings({ [key]: value })
  }

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Settings</p>
          <h1>Appearance</h1>
          <p className="whisper">Written here first. The cloud is a copy, not the only copy.</p>
        </div>
      </header>
      <div className="page-body">
        <section>
          <h2>Theme</h2>
          <div className="choice-row">
            {(['light', 'dark', 'system'] as const).map((theme) => (
              <Choice key={theme} name="theme" value={theme} current={settings.theme} onChange={(value) => set('theme', value)}>
                {theme}
              </Choice>
            ))}
          </div>
          <h2>Paper</h2>
          <div className="choice-row">
            {(['dotted', 'grid', 'ruled', 'blank'] as PaperStyle[]).map((paper) => (
              <Choice key={paper} name="paper" value={paper} current={settings.paperStyle} onChange={(value) => set('paperStyle', value)}>
                {paper}
              </Choice>
            ))}
          </div>
          <h2>Handwriting</h2>
          <div className="choice-row">
            {(
              [
                ['patrick', 'Patrick Hand'],
                ['kalam', 'Kalam'],
                ['caveat', 'Caveat'],
                ['architects', 'Architects Daughter'],
              ] as const
            ).map(([font, label]) => (
              <Choice key={font} name="font" value={font} current={settings.font} onChange={(value) => set('font', value as HandFont)}>
                {label}
              </Choice>
            ))}
          </div>
          <h2>Size</h2>
          <div className="choice-row">
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <Choice key={size} name="size" value={size} current={settings.fontSize} onChange={(value) => set('fontSize', value)}>
                {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
              </Choice>
            ))}
          </div>
          <div className="preview-sheet" aria-hidden="true">
            <p className="kicker">Preview</p>
            <p className="preview-title">Monday</p>
            <p>7:15 ○ Woke up slowly</p>
            <p>• Write the day down</p>
            <p>– A note can stay a note</p>
          </div>
        </section>
        <section>
          <h2>Logging</h2>
          <label className="check-line">
            <input
              type="checkbox"
              checked={settings.showTimestampsByDefault}
              onChange={(event) => set('showTimestampsByDefault', event.target.checked)}
            />
            Show a time on new entries
          </label>
          <h3>Week starts</h3>
          <div className="choice-row">
            <Choice name="week" value={0} current={settings.firstDayOfWeek} onChange={(value) => set('firstDayOfWeek', value)}>
              Sunday
            </Choice>
            <Choice name="week" value={1} current={settings.firstDayOfWeek} onChange={(value) => set('firstDayOfWeek', value)}>
              Monday
            </Choice>
          </div>
          <h3>Dates</h3>
          <div className="choice-row">
            <Choice name="date" value="mdy" current={settings.dateFormat} onChange={(value) => set('dateFormat', value)}>
              September 25, 2026
            </Choice>
            <Choice name="date" value="dmy" current={settings.dateFormat} onChange={(value) => set('dateFormat', value)}>
              25 September 2026
            </Choice>
          </div>
        </section>
        <section>
          <h2>Account</h2>
          <p>{auth.user?.email}</p>
          <label className="field">
            <span>Display name</span>
            <input className="ink-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} onBlur={() => void auth.updateDisplayName(displayName).then((error) => setMessage(error ?? 'Name kept.'))} />
          </label>
          <p className="whisper">Last sync: {sync.lastSync ? new Date(sync.lastSync).toLocaleString() : 'Not yet'}</p>
          <p className="whisper">Pending changes: {sync.pending}</p>
          <p className="whisper">Cloud sync: {sync.phase === 'offline' ? 'Offline — saved locally' : 'Enabled'}</p>
          <div className="page-links">
            <button type="button" className="quiet-btn" onClick={() => void syncService.syncNow()}>
              Sync now
            </button>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                void auth.updatePassword(password).then((error) => setMessage(error ?? 'Password changed.'))
                setPassword('')
              }}
            >
              Change password
            </button>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                void syncService.syncNow().finally(() => auth.signOut())
              }}
            >
              Sign out
            </button>
          </div>
          <label className="field">
            <span>New password</span>
            <input className="ink-input" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="button" className="quiet-btn danger" onClick={() => setErase(true)}>
            Delete account
          </button>
        </section>
        <section>
          <h2>Data & backup</h2>
          <p className="whisper">Export a copy when you want one. Cloud sync does not replace a file you can keep. Importing asks before it changes anything, and saves a backup first.</p>
          <div className="page-links">
            <button
              type="button"
              className="quiet-btn"
              onClick={() =>
                downloadText(
                  `my-bullet-journal-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify({ ...snapshot, exportedAt: new Date().toISOString() }, null, 2),
                  'application/json',
                )
              }
            >
              Export full journal
            </button>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                const review = snapshot.reviews[0]
                if (!review) return
                downloadText(`review-${review.year}-q${review.quarter}.md`, reviewToMarkdown(snapshot, review), 'text/markdown')
              }}
            >
              Export a review
            </button>
            <button type="button" className="quiet-btn" onClick={() => void journal.backupNow().then(() => setMessage('A local backup was saved on this device.'))}>
              Create local backup
            </button>
            <label className="quiet-btn file-btn">
              Import journal
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  try {
                    const parsed = JSON.parse(await file.text()) as unknown
                    setImporting(migrateSnapshot(parsed))
                  } catch {
                    setImporting({
                      ok: false,
                      errors: ['That file could not be read as JSON.'],
                      warnings: [],
                      summary: { entries: 0, goals: 0, collections: 0, reflections: 0, reviews: 0, futureItems: 0, from: null, to: null },
                      snapshot: null,
                    })
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                const month = snapshot.monthlyLogs[0]
                if (!month) return
                downloadText(`${month.year}-${month.month}.md`, monthToMarkdown(snapshot, month.year, month.month), 'text/markdown')
              }}
            >
              Export a month
            </button>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                const collection = snapshot.collections[0]
                if (!collection) return
                downloadText(`${collection.title || 'collection'}.md`, collectionToMarkdown(collection), 'text/markdown')
              }}
            >
              Export a collection
            </button>
          </div>
          {backupAt && (
            <p className="whisper">
              A local backup exists from {new Date(backupAt).toLocaleString()}.{' '}
              <button
                type="button"
                className="quiet-btn"
                onClick={() => {
                  void journal.restoreBackup().then((ok) => setMessage(ok ? 'Restored the last backup.' : 'No backup was saved yet.'))
                }}
              >
                Restore it
              </button>
            </p>
          )}
          {message && <p className="whisper">{message}</p>}
        </section>
        <section>
          <h2>Install</h2>
          {standalone ? (
            <p>This journal is installed on this device.</p>
          ) : install ? (
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                void install.prompt()
                setInstall(null)
              }}
            >
              Add to your home screen
            </button>
          ) : (
            <p className="whisper">After the first visit, this journal works offline. You can install it from the browser menu.</p>
          )}
        </section>
        {import.meta.env.DEV && (
          <section>
            <h2>Sample pages</h2>
            <p className="whisper">This replaces the open journal with the sample notebook. It is only offered while developing.</p>
            <button type="button" className="quiet-btn" onClick={() => journal.loadSample()}>
              Load sample journal
            </button>
          </section>
        )}
        <p className="colophon">Capture everything. Commit to very little.</p>
      </div>
      <PaperDialog
        open={Boolean(importing)}
        title={importing?.ok ? 'Bring this journal in?' : 'This file can’t be imported'}
        confirmLabel={importing?.ok ? 'Merge' : ''}
        onClose={() => setImporting(null)}
        onConfirm={() => {
          if (importing?.snapshot) {
            downloadText(
              `bullet-journal-backup-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify(snapshot, null, 2),
              'application/json',
            )
            void journal.importSnapshot(importing.snapshot, 'merge').then(() => {
              setMessage('Merged. A backup of the previous journal was saved.')
              setImporting(null)
            })
          }
        }}
      >
        {importing && !importing.ok && importing.errors.map((error) => <p key={error}>{error}</p>)}
        {importing?.ok && importing.snapshot && (
          <>
            <p>
              {importing.summary.entries} entries · {importing.summary.goals} goals · {importing.summary.collections} collections
            </p>
            {importing.summary.from && (
              <p>
                {importing.summary.from} → {importing.summary.to}
              </p>
            )}
            {importing.warnings.map((warning) => (
              <p key={warning} className="whisper">
                {warning}
              </p>
            ))}
            <p>A backup of what is here now will download before anything changes.</p>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                if (!importing.snapshot) return
                downloadText(
                  `bullet-journal-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(snapshot, null, 2),
                  'application/json',
                )
                void journal.importSnapshot(importing.snapshot, 'replace').then(() => {
                  setMessage('Replaced this journal. The previous one was backed up.')
                  setImporting(null)
                })
              }}
            >
              Replace instead
            </button>
          </>
        )}
      </PaperDialog>
      <PaperDialog
        open={erase}
        title="Erase this account?"
        confirmLabel={eraseText === 'erase' ? 'Delete account' : ''}
        dismissLabel="Keep the journal"
        onClose={() => {
          setErase(false)
          setEraseText('')
        }}
        onConfirm={() => {
          const userId = auth.user?.id
          if (!userId || eraseText !== 'erase') return
          void auth.deleteAccount().then(async (error) => {
            if (error) {
              setMessage(error)
              return
            }
            await deleteDatabase(databaseName(userId))
            setErase(false)
          })
        }}
      >
        <p>This removes the account and its cloud journal. Type erase to confirm.</p>
        <input className="ink-input" value={eraseText} onChange={(event) => setEraseText(event.target.value)} aria-label="Type erase to confirm" />
      </PaperDialog>
    </article>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}
