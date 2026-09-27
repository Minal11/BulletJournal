import { copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vitest/config'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function journalPwa(): Plugin {
  return {
    name: 'journal-pwa',
    apply: 'build',
    closeBundle() {
      const dist = 'dist'
      const assets = walk(dist)
        .map((file) => `./${relative(dist, file).split('\\').join('/')}`)
        .filter((file) => file !== './sw.js' && !file.includes('/demo/'))
      const worker = `const CACHE = 'my-bullet-journal-${Date.now()}'
const ASSETS = ${JSON.stringify(['./', ...assets])}
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.filter((asset) => asset !== './'))))
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match('./index.html'))
    }),
  )
})
`
      writeFileSync(join(dist, 'sw.js'), worker)
      copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))
    },
  }
}

export default defineConfig({
  base: './',
  server: { host: true },
  plugins: [react(), tailwindcss(), journalPwa()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
