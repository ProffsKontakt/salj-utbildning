import { test, expect } from '@playwright/test'
import { makePdf, waitForRenderedPage, nonWhiteFraction, collectErrors } from './helpers.js'

// Runs against the production build (vite preview): verifies the bundled pdf.js worker,
// asset paths, service worker registration and the manifest.
test.describe('Produktionsbygge', () => {
  test('loads, registers the service worker and renders an imported PDF', async ({ page, baseURL }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('import-files')).toBeVisible()

    const manifest = await page.request.get(`${baseURL}/manifest.webmanifest`)
    expect(manifest.ok()).toBe(true)
    const m = await manifest.json()
    expect(m.name).toBe('Notställ')
    expect(m.icons.length).toBeGreaterThanOrEqual(3)
    for (const icon of m.icons) expect((await page.request.get(`${baseURL}${icon.src}`)).ok()).toBe(true)
    expect((await page.request.get(`${baseURL}/pdfjs/wasm/openjpeg.wasm`)).ok()).toBe(true)

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-files').click()])
    await chooser.setFiles({ name: 'Prod.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) })
    await page.getByTestId('import-confirm').click()
    await page.waitForURL(/\/noter\/[^/]+$/, { timeout: 60_000 })
    const first = await waitForRenderedPage(page)
    expect(await nonWhiteFraction(first)).toBeGreaterThan(0.02)

    // deep link works after reload (SPA fallback) and the SW is registered
    await page.reload()
    await waitForRenderedPage(page)
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported'
      const reg = await navigator.serviceWorker.getRegistration()
      return reg ? 'registered' : 'none'
    })
    expect(['registered', 'unsupported']).toContain(sw)
    expect(errors).toEqual([])
  })
})
