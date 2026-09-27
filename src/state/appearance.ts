import type { AppSettings } from '../domain/types.ts'

const KEY = 'bj-appearance'

export function applyAppearance(settings: AppSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.paper = settings.paperStyle
  root.dataset.font = settings.font
  root.dataset.size = settings.fontSize
  root.style.colorScheme = dark ? 'dark' : 'light'
  const themeColor = dark ? '#1c1916' : '#f7f1e6'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  localStorage.setItem(
    KEY,
    JSON.stringify({
      theme: settings.theme,
      paper: settings.paperStyle,
      font: settings.font,
      size: settings.fontSize,
    }),
  )
}
