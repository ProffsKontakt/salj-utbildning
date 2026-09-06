// Shared helpers for the Notställ end-to-end suite.
import { expect } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/** Distinct aspect ratios so page identity can be asserted from rendered canvas size. */
export const PAGE_SIZES = [
  [400, 600], // 0: portrait 2:3
  [600, 400], // 1: landscape 3:2
  [500, 500], // 2: square
  [300, 700], // 3: tall
]

/** Build a PDF whose pages have distinct sizes and a big page number + a dark band. */
export async function makePdf(pageCount = 3, sizes = PAGE_SIZES) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  for (let i = 0; i < pageCount; i++) {
    const [w, h] = sizes[i % sizes.length]
    const page = doc.addPage([w, h])
    page.drawRectangle({ x: 0, y: h * 0.45, width: w, height: h * 0.1, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(String(i + 1), { x: w * 0.15, y: h * 0.62, size: Math.min(w, h) * 0.5, font, color: rgb(0, 0, 0) })
    page.drawText(`Sida ${i + 1}`, { x: 20, y: 20, size: 18, font, color: rgb(0.2, 0.2, 0.2) })
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }))
}

export function aspect([w, h]) {
  return w / h
}

/** Generate a PNG image (as a Buffer) by screenshotting a coloured element in a scratch page. */
export async function makePng(browser, { width = 600, height = 800, label = 'A', color = '#e8e2d4' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.setContent(
    `<style>html,body{margin:0}#p{width:${width}px;height:${height}px;background:${color};display:flex;align-items:center;justify-content:center;font:bold ${Math.floor(height / 3)}px serif;color:#222}</style><div id="p">${label}</div>`,
  )
  const buf = await page.locator('#p').screenshot({ type: 'png' })
  await ctx.close()
  return buf
}

/** Read a table from the app's IndexedDB via the app's own db module (dev server only). */
export async function readTable(page, table) {
  return page.evaluate(async (t) => {
    const { db } = await import('/src/db/db.js')
    return db.table(t).toArray().then((rows) =>
      rows.map((r) => {
        const c = { ...r }
        for (const k of Object.keys(c)) if (c[k] instanceof ArrayBuffer) c[k] = `<ArrayBuffer ${c[k].byteLength}>`
        return c
      }),
    )
  }, table)
}

/**
 * Import a PDF through the UI: click the import button, feed the file chooser, confirm the dialog.
 * Returns the score id (from the viewer URL).
 */
export async function importPdfViaUi(page, buffer, name = 'Ave_Maria.pdf', { title } = {}) {
  await page.goto('/')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-files').click()])
  await chooser.setFiles({ name, mimeType: 'application/pdf', buffer })
  const dialog = page.getByTestId('import-dialog')
  await expect(dialog).toBeVisible()
  if (title) {
    const field = page.getByTestId('import-title').first()
    await field.fill(title)
  }
  await page.getByTestId('import-confirm').click()
  await page.waitForURL(/\/noter\/[^/]+$/, { timeout: 60_000 })
  const id = page.url().split('/noter/')[1].split(/[?#]/)[0]
  return id
}

/** Wait until the visible current page canvas in the viewer has rendered. */
export async function waitForRenderedPage(page, stageTestId = 'viewer-stage') {
  const stage = page.getByTestId(stageTestId)
  const rendered = stage.locator('[data-page-index][data-rendered="true"]:visible').first()
  await expect(rendered).toBeVisible({ timeout: 60_000 })
  return rendered
}

/** Fraction of non-white pixels on a canvas element (0..1). */
export async function nonWhiteFraction(locator) {
  return locator.evaluate((el) => {
    const canvas = el.tagName === 'CANVAS' ? el : el.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    if (!width || !height) return 0
    const d = ctx.getImageData(0, 0, width, height).data
    let dark = 0
    const total = width * height
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) dark++
    return dark / total
  })
}

/** Fraction of pixels with alpha > 0 on a (transparent) overlay canvas. */
export async function paintedFraction(locator) {
  return locator.evaluate((canvas) => {
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    if (!width || !height) return 0
    const d = ctx.getImageData(0, 0, width, height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
    return n / (width * height)
  })
}

/** Rendered CSS size of the current page box in the viewer. */
export async function currentPageBox(page, stageTestId = 'viewer-stage') {
  const rendered = await waitForRenderedPage(page, stageTestId)
  const box = await rendered.boundingBox()
  return { ...box, ratio: box.width / box.height, sourceIndex: Number(await rendered.getAttribute('data-page-index')) }
}

/** Drag the mouse across an element from (fx0,fy0) to (fx1,fy1) given as fractions of its box. */
export async function dragAcross(page, locator, fx0, fy0, fx1, fy1, steps = 12) {
  const box = await locator.boundingBox()
  const x0 = box.x + box.width * fx0
  const y0 = box.y + box.height * fy0
  const x1 = box.x + box.width * fx1
  const y1 = box.y + box.height * fy1
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
  }
  await page.mouse.up()
}

export function collectErrors(page) {
  const errors = []
  const isFontHost = (url = '') => /fonts\.(googleapis|gstatic)\.com/.test(url)
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  // Network failures carry their URL here; the sandbox blocks Google Fonts, which is not an app error.
  page.on('requestfailed', (req) => {
    const url = req.url()
    const reason = req.failure()?.errorText || ''
    if (isFontHost(url)) return
    // Navigating away cancels in-flight module/asset loads; that is not an app error.
    if (/ERR_ABORTED/.test(reason)) return
    errors.push(`requestfailed: ${url} ${reason}`)
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    const url = m.location()?.url || ''
    if (isFontHost(url) || isFontHost(t)) return
    // Resource-load failures are reported (with URL) by 'requestfailed' above.
    if (/^Failed to load resource/.test(t)) return
    errors.push(`console: ${t}${url ? ` (${url})` : ''}`)
  })
  return errors
}
