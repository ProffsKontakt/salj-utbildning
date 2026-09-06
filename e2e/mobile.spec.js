import { test, expect } from '@playwright/test'
import { makePdf, importPdfViaUi, waitForRenderedPage, collectErrors } from './helpers.js'

test.describe('Mobil layout', () => {
  test('library, viewer and page manager fit a phone screen', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    // bottom tab bar visible, no horizontal overflow
    await expect(page.getByRole('navigation', { name: 'Huvudmeny' }).last()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: 'test-results/mobile-library-empty.png' })

    await importPdfViaUi(page, await makePdf(2), 'Mobil.pdf')
    await waitForRenderedPage(page)
    await page.screenshot({ path: 'test-results/mobile-viewer.png' })
    // page fits inside the viewport
    const box = await page.getByTestId('viewer-stage').locator('[data-page-index][data-rendered="true"]:visible').first().boundingBox()
    const vp = page.viewportSize()
    expect(box.width).toBeLessThanOrEqual(vp.width + 1)
    expect(box.height).toBeLessThanOrEqual(vp.height + 1)

    await page.getByTestId('tool-pen').click()
    await page.screenshot({ path: 'test-results/mobile-viewer-tools.png' })

    await page.goto(page.url().split('?')[0] + '/sidor')
    await expect(page.getByTestId('page-tile')).toHaveCount(2)
    await page.screenshot({ path: 'test-results/mobile-pages.png' })
    expect(errors).toEqual([])
  })
})
