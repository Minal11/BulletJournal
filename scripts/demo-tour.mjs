/**
 * Record the in-app demo tour against the local development server.
 *
 *   npm run demo:tour
 *
 * Uses a fresh browser and the /demo notebook, so a signed-in journal is never opened.
 * Requires Playwright's Chromium and ffmpeg. The script installs neither by itself
 * beyond what `npm install` already fetched; install the browser once with:
 *
 *   npx playwright install chromium
 *
 * Intermediate WebM files stay in demo-recordings/ and are not part of the app.
 * The files the app plays are:
 *
 *   public/demo/bullet-journal-tour.mp4
 *   public/demo/bullet-journal-tour-poster.webp
 */
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, rename } from 'node:fs/promises'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const ffmpeg = require('ffmpeg-static')

const base = 'http://127.0.0.1:5173'
const time = new Date(2026, 8, 27, 15, 0, 0)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function serverIsUp() {
  try {
    const response = await fetch(base)
    return response.ok
  } catch {
    return false
  }
}

function startServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    stdio: 'inherit',
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ''}` },
  })
  return child
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverIsUp()) return
    if (child && child.exitCode !== null) throw new Error('The dev server exited before it was ready.')
    await sleep(500)
  }
  throw new Error('The dev server did not start.')
}

async function caption(page, text) {
  await page.evaluate((message) => {
    let node = document.getElementById('tour-caption')
    if (!node) {
      node = document.createElement('p')
      node.id = 'tour-caption'
      node.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:1.6rem',
        'transform:translateX(-50%)',
        'z-index:90',
        'margin:0',
        'max-width:36rem',
        'padding:0.35rem 0.9rem',
        'font-family:"Patrick Hand",cursive',
        'font-size:1.7rem',
        'line-height:1.25',
        'text-align:center',
        'white-space:pre-line',
        'color:#6d342c',
        'background:rgba(247,241,230,0.94)',
        'border-left:2px solid #a84f43',
        'pointer-events:none',
      ].join(';')
      document.body.appendChild(node)
    }
    node.textContent = message
    node.style.display = message ? 'block' : 'none'
  }, text)
}

async function point(page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) return
  const x = box.x + Math.min(box.width / 2, 80)
  const y = box.y + box.height / 2
  await page.mouse.move(x, y, { steps: 16 })
  await page.evaluate(({ x: left, y: top }) => {
    const cursor = document.getElementById('tour-cursor')
    if (!cursor) return
    cursor.style.left = `${left}px`
    cursor.style.top = `${top}px`
  }, { x, y })
}

async function click(page, locator) {
  await point(page, locator)
  await sleep(160)
  await locator.click()
}

async function chooseKind(page, name) {
  await click(page, page.locator('.log-composer .symbol-btn'))
  await sleep(180)
  await click(page, page.getByRole('option', { name, exact: true }))
  await sleep(220)
}

async function logLine(page, text) {
  const input = page.getByLabel('New entry', { exact: true })
  await point(page, input)
  await input.click()
  await input.pressSequentially(text, { delay: 26 })
  await sleep(280)
  await page.keyboard.press('Enter')
  await sleep(520)
}

async function planLine(page, when, text) {
  const time = page.getByLabel('New plan time')
  const line = page.getByLabel('New plan line')
  await point(page, time)
  await time.click()
  await time.fill('')
  await time.pressSequentially(when, { delay: 40 })
  await line.click()
  await line.pressSequentially(text, { delay: 26 })
  await sleep(200)
  await page.keyboard.press('Enter')
  await sleep(420)
}

const startedHere = !(await serverIsUp())
const server = startedHere ? startServer() : null
if (startedHere) await waitForServer(server)

await mkdir('demo-recordings', { recursive: true })
await mkdir('public/demo', { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  recordVideo: { dir: 'demo-recordings', size: { width: 1920, height: 1080 } },
})
await context.addInitScript(() => {
  const paint = () => {
    if (document.getElementById('tour-cursor')) return
    const cursor = document.createElement('div')
    cursor.id = 'tour-cursor'
    cursor.style.cssText = 'position:fixed;width:16px;height:16px;margin:-2px 0 0 -2px;border:2px solid #2b261f;border-radius:999px;background:rgba(247,241,230,0.4);pointer-events:none;z-index:100;left:48px;top:48px;'
    document.body.appendChild(cursor)
    window.addEventListener('mousemove', (event) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
  }
  if (document.body) paint()
  else document.addEventListener('DOMContentLoaded', paint)
})

const page = await context.newPage()
await page.clock.install({ time })
await page.goto(`${base}/#/demo`, { waitUntil: 'domcontentloaded' })
await page.getByLabel('New entry', { exact: true }).waitFor({ timeout: 20000 })
await sleep(600)

await caption(page, 'Your day, captured simply.')
await sleep(5500)

await caption(page, '')
await logLine(page, 'Review project notes')
await chooseKind(page, 'Event')
await logLine(page, 'Dinner with family')
await chooseKind(page, 'Note')
await logLine(page, 'Felt focused this morning.')
await chooseKind(page, 'Memory')
await logLine(page, 'A moment I want to remember')
await click(page, page.getByRole('button', { name: 'Task, Open. Change state.' }))
await sleep(1500)

await caption(page, 'Plan the day. Record what actually happened.')
await planLine(page, '9:00', 'Focus work')
await planLine(page, '12:00', 'Lunch')
await planLine(page, '6:00', 'Family time')
await sleep(1600)

await caption(page, 'Month = focus')
await click(page, page.getByRole('link', { name: 'Monthly Log', exact: true }).first())
await page.getByRole('heading', { name: 'Monthly goal focus' }).waitFor()
await page.getByRole('heading', { name: 'Monthly goal focus' }).scrollIntoViewIfNeeded()
await sleep(4000)
await page.getByRole('heading', { name: /tasks/i }).scrollIntoViewIfNeeded()
await sleep(2000)

await caption(page, 'Quarter = direction')
await click(page, page.getByRole('link', { name: 'Goals', exact: true }).first())
await page.getByRole('heading', { level: 1 }).waitFor()
await sleep(1200)
await page.locator('input.goal-title[value="Career"]').scrollIntoViewIfNeeded()
await sleep(3600)

await caption(page, 'Give important topics their own pages.')
await click(page, page.getByRole('link', { name: 'Collections', exact: true }).first())
await page.getByRole('link', { name: 'Travel Plans' }).waitFor()
await sleep(1400)
await click(page, page.getByRole('link', { name: 'Travel Plans' }))
await page.getByLabel('Collection title').waitFor()
await sleep(2400)

await caption(page, "Keep what matters. Let go of what doesn't.")
await click(page, page.getByRole('link', { name: 'Reflections', exact: true }).first())
await page.getByRole('link', { name: 'September 2026 reflection' }).waitFor()
await sleep(700)
await click(page, page.getByRole('link', { name: 'September 2026 reflection' }))
await page.getByRole('heading', { name: '2. What went well?' }).waitFor()
for (const heading of ['2. What went well?', '3. What felt heavy?', '4. What did I learn?', '8. More of / less of', '9. Migration', 'in one sentence']) {
  await page.getByRole('heading', { name: heading }).scrollIntoViewIfNeeded()
  await sleep(1400)
}

await caption(page, '')
await click(page, page.getByRole('link', { name: 'Today', exact: true }).first())
await page.getByRole('heading', { level: 1 }).waitFor()
await sleep(500)
await page.screenshot({ path: 'public/demo/bullet-journal-tour-poster.png' })
await caption(page, 'Quarter = direction\nMonth = focus\nDay = action + reality')
await sleep(2200)
await caption(page, 'Capture everything.\nCommit to very little.')
await sleep(2600)

const video = page.video()
await context.close()
await browser.close()
if (!video) throw new Error('Playwright did not record a video.')
const webm = await video.path()
const savedWebm = 'demo-recordings/bullet-journal-tour.webm'
await rename(webm, savedWebm)

if (!ffmpeg) throw new Error('ffmpeg-static did not provide a binary. Install it with npm install, then run this script again.')
const encoded = spawnSync(ffmpeg, ['-y', '-i', savedWebm, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', 'public/demo/bullet-journal-tour.mp4'], { stdio: 'inherit' })
if (encoded.status !== 0) {
  console.error('ffmpeg could not write the mp4. The WebM recording is at', savedWebm)
  process.exitCode = 1
} else {
  const poster = spawnSync(ffmpeg, ['-y', '-i', 'public/demo/bullet-journal-tour-poster.png', 'public/demo/bullet-journal-tour-poster.webp'], { stdio: 'inherit' })
  if (poster.status !== 0) {
    console.error('ffmpeg could not write the poster. A PNG is at public/demo/bullet-journal-tour-poster.png')
    process.exitCode = 1
  }
  const probe = spawnSync(ffmpeg, ['-i', 'public/demo/bullet-journal-tour.mp4'], { encoding: 'utf8' })
  const details = `${probe.stderr}\n${probe.stdout}`
  const duration = details.match(/Duration: (\d+:\d+:\d+\.\d+)/)?.[1]
  const size = details.match(/Video: .*?(\d{3,4}x\d{3,4})/)?.[1]
  console.log(`duration ${duration ?? 'unknown'} size ${size ?? 'unknown'}`)
}

if (server) server.kill('SIGTERM')
