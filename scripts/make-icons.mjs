// Renders the app icon to PNG at the sizes the manifest needs, using the
// Chromium bundled with Playwright. Run: npm run icons
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'public')
mkdirSync(join(out, 'icons'), { recursive: true })

// maskable: content inside the central 80% safe zone, background bleeds to the edge.
const svg = ({ size, radius, pad }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8cf86"/>
      <stop offset="1" stop-color="#c9a24a"/>
    </linearGradient>
    <radialGradient id="bg" cx="50%" cy="0%" r="90%">
      <stop offset="0" stop-color="#241f2e"/>
      <stop offset="1" stop-color="#0b0a0e"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(32 32) scale(${1 - pad}) translate(-32 -32)">
    <path d="M10 39c6-16 38-16 44 0" fill="none" stroke="url(#g)" stroke-width="4.6" stroke-linecap="round"/>
    <circle cx="32" cy="43.5" r="5.6" fill="url(#g)"/>
  </g>
</svg>`

const targets = [
  { file: 'icons/icon-192.png', size: 192, radius: 0, pad: 0 },
  { file: 'icons/icon-512.png', size: 512, radius: 0, pad: 0 },
  { file: 'icons/icon-512-maskable.png', size: 512, radius: 0, pad: 0.16 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, pad: 0 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(t)}`)
  const buf = await page.locator('svg').screenshot({ omitBackground: true, type: 'png' })
  writeFileSync(join(out, t.file), buf)
  console.log('wrote', t.file, buf.length, 'bytes')
}
await browser.close()
