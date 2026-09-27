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
})
