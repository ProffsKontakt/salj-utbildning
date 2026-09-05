import { test, expect } from '@playwright/test'
import { makePdf, importPdfViaUi, waitForRenderedPage, currentPageBox, readTable, collectErrors, PAGE_SIZES, aspect } from './helpers.js'

async function tileOrder(page) {
  return page.getByTestId('page-tile').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-source-index'))))
}

test.describe('Sidhanterare', () => {
  test('reorder, rotate, remove, restore – persisted and reflected in the viewer', async ({ page }) => {
    const errors = collectErrors(page)
    const id = await importPdfViaUi(page, await makePdf(4), 'Fyra.pdf')
    await waitForRenderedPage(page)

    await page.getByTestId('viewer-menu').click()
    await page.getByTestId('page-manager-link').click()
    await page.waitForURL(/\/sidor$/)
    await expect(page.getByTestId('page-tile')).toHaveCount(4)
    expect(await tileOrder(page)).toEqual([0, 1, 2, 3])

    // move first page right
    await page.getByTestId('page-tile').first().getByTestId('tile-move-right').click()
    await expect.poll(() => tileOrder(page)).toEqual([1, 0, 2, 3])
    await expect.poll(async () => (await readTable(page, 'scores'))[0].pageOrder).toEqual([1, 0, 2, 3])

    // rotate the (new) first tile → source 1
    await page.getByTestId('page-tile').first().getByTestId('tile-rotate').click()
    await expect.poll(async () => (await readTable(page, 'scores'))[0].rotations).toEqual({ 1: 90 })

    // remove the last tile (source 3)
    await page.getByTestId('page-tile').last().getByTestId('tile-remove').click()
    await expect.poll(() => tileOrder(page)).toEqual([1, 0, 2])
    await expect(page.getByTestId('removed-pages')).toBeVisible()
    await expect(page.getByTestId('restore-page')).toHaveCount(1)

    // restore it → appended at the end
    await page.getByTestId('restore-page').click()
    await expect.poll(() => tileOrder(page)).toEqual([1, 0, 2, 3])
    await expect.poll(async () => (await readTable(page, 'scores'))[0].pageOrder).toEqual([1, 0, 2, 3])

    // remove again and go back to the viewer: 3 pages, first is source 1 rotated 90°
    await page.getByTestId('page-tile').last().getByTestId('tile-remove').click()
    await expect.poll(() => tileOrder(page)).toEqual([1, 0, 2])
    await page.getByTestId('pages-done').click()
    await page.waitForURL(new RegExp(`/noter/${id}$`))
    await expect(page.getByTestId('page-indicator')).toContainText('1 / 3')
    const box = await currentPageBox(page)
    expect(box.sourceIndex).toBe(1)
    // source page 1 is 600×400 (landscape); rotated 90° it renders portrait 400×600
    expect(Math.abs(box.ratio - 1 / aspect(PAGE_SIZES[1]))).toBeLessThan(0.05)

    // the library thumbnail was refreshed (still present)
    const [score] = await readTable(page, 'scores')
    expect(score.thumb).toMatch(/ArrayBuffer/)
    expect(errors).toEqual([])
  })

  test('cannot remove the last remaining page', async ({ page }) => {
    await importPdfViaUi(page, await makePdf(1), 'En.pdf')
    await waitForRenderedPage(page)
    await page.goto(page.url() + '/sidor')
    await expect(page.getByTestId('page-tile')).toHaveCount(1)
    await expect(page.getByTestId('page-tile').first().getByTestId('tile-remove')).toBeDisabled()
  })
})
