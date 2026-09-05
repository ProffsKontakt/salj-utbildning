import { test, expect } from '@playwright/test'
import { makePng, waitForRenderedPage, currentPageBox, readTable, collectErrors } from './helpers.js'

test.describe('Skanna (bilder → PDF)', () => {
  test('two captured images become a two-page score', async ({ page, browser }) => {
    const errors = collectErrors(page)
    const img1 = await makePng(browser, { width: 600, height: 800, label: '1' })
    const img2 = await makePng(browser, { width: 800, height: 600, label: '2' })

    await page.goto('/')
    await page.getByTestId('scan-button').click()

    let [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('scan-take').click()])
    await chooser.setFiles({ name: 'IMG_0001.png', mimeType: 'image/png', buffer: img1 })
    await expect(page.getByTestId('scan-remove')).toHaveCount(1)
    ;[chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('scan-take').click()])
    await chooser.setFiles({ name: 'IMG_0002.png', mimeType: 'image/png', buffer: img2 })
    await expect(page.getByTestId('scan-remove')).toHaveCount(2)

    // move second before first, then done
    await page.getByTestId('scan-move-left').nth(1).click()
    await page.getByTestId('scan-done').click()

    await expect(page.getByTestId('import-dialog')).toBeVisible()
    await page.getByTestId('import-title').first().fill('Skannad aria')
    await page.getByTestId('import-confirm').click()
    await page.waitForURL(/\/noter\/[^/]+$/, { timeout: 90_000 })

    await waitForRenderedPage(page)
    await expect(page.getByTestId('page-indicator')).toContainText('1 / 2')
    // first page is the landscape image (moved left)
    const box = await currentPageBox(page)
    expect(box.ratio).toBeGreaterThan(1)

    const [score] = await readTable(page, 'scores')
    expect(score.title).toBe('Skannad aria')
    expect(score.pageCount).toBe(2)
    expect(errors).toEqual([])
  })
})
