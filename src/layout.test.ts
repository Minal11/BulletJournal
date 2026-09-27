/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8')

describe('notebook margin layout', () => {
  it('keeps the timestamp, the red margin, and the entry in separate columns', () => {
    expect(css).toContain('--time-col:')
    expect(css).toContain('--margin-gap:')
    expect(css).toContain('grid-template-columns: var(--time-col) var(--margin-gap) var(--bullet-col) minmax(0, 1fr)')
    expect(css).toContain('grid-template-columns: var(--time-col) var(--margin-gap) minmax(0, 1fr) auto')
    expect(css).toMatch(/\.log-composer \.composer-input\s*\{[^}]*width:\s*100%/)
    expect(css).toMatch(/\.log-composer \.composer-input\s*\{[^}]*min-width:\s*0/)
  })

  it('lets the Today header span the page while the red margin stays on the journal body', () => {
    const today = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pages/TodayPage.tsx'), 'utf8')
    const headerAt = today.indexOf('today-head')
    const bodyAt = today.indexOf('page-body')
    expect(headerAt).toBeGreaterThan(-1)
    expect(headerAt).toBeLessThan(bodyAt)
    expect(css).toMatch(/\.day-head\.today-head\s*\{[^}]*margin:\s*0 0 1\.15rem/)
    expect(css).toMatch(/\.day-head\.today-head\s*\{\s*margin-left:\s*0/)
    expect(css).toMatch(/\.today-head h1\s*\{[^}]*white-space:\s*nowrap/)
    expect(css).toContain('--time-col: 4.55rem')
    expect(css).toContain('--time-col: 4.35rem')
  })

  it('keeps signifiers in one group and does not pin the entry menu to the screen corner', () => {
    expect(css).toMatch(/\.entry-signifiers\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(css).toMatch(/\.entry-tools\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(css).not.toMatch(/\.entry-menu\s*\{[^}]*bottom:\s*0/)
    expect(css).not.toMatch(/\.entry-menu\s*\{[^}]*right:\s*0/)
    const entries = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'components/entries.tsx'), 'utf8')
    expect(entries).toContain('entry-signifiers')
    expect(entries).toContain('claimEntryMenu')
    expect(entries).toContain('menuOnScroll')
  })
})
