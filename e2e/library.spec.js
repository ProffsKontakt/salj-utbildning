import { test, expect } from '@playwright/test'
import { makePdf, importPdfViaUi, readTable, collectErrors } from './helpers.js'

test.describe('Bibliotek & import', () => {
  test('empty state, import via file dialog, card appears, search and delete', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await expect(page.getByText('Ditt notställ är tomt')).toBeVisible()
    await expect(page.getByTestId('import-files')).toBeVisible()
    await expect(page.getByTestId('scan-button')).toBeVisible()

    const pdf = await makePdf(3)
    await importPdfViaUi(page, pdf, 'Ave_Maria.pdf')

    await page.goto('/')
    const card = page.getByTestId('score-card')
    await expect(card).toHaveCount(1)
    await expect(card.first()).toContainText('Ave Maria')
    await expect(card.first()).toContainText('3 sidor')

    const scores = await readTable(page, 'scores')
    expect(scores).toHaveLength(1)
    expect(scores[0].pageCount).toBe(3)
    expect(scores[0].pageOrder).toEqual([0, 1, 2])
    expect(scores[0].thumb).toMatch(/ArrayBuffer/)

    // second import with a custom title
    await importPdfViaUi(page, await makePdf(2), 'Laudate.pdf', { title: 'Laudate Dominum' })
    await page.goto('/')
    await expect(page.getByTestId('score-card')).toHaveCount(2)

    // search
    await page.getByTestId('library-search').fill('laudate')
    await expect(page.getByTestId('score-card')).toHaveCount(1)
    await expect(page.getByTestId('score-card').first()).toContainText('Laudate Dominum')
    await page.getByTestId('library-search').fill('')
    await expect(page.getByTestId('score-card')).toHaveCount(2)

    // delete via card menu
    const target = page.getByTestId('score-card').filter({ hasText: 'Laudate Dominum' })
    await target.getByTestId('score-menu').click()
    await page.getByRole('menuitem', { name: /Ta bort(?! nedladdning)/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Ta bort/ }).click()
    await expect(page.getByTestId('score-card')).toHaveCount(1)
    expect(await readTable(page, 'files')).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test('multiple PDFs in one import create one score each', async ({ page }) => {
    await page.goto('/')
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-files').click()])
    await chooser.setFiles([
      { name: 'Ett.pdf', mimeType: 'application/pdf', buffer: await makePdf(1) },
      { name: 'Tva.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
    ])
    await expect(page.getByTestId('import-dialog')).toBeVisible()
    await expect(page.getByTestId('import-title')).toHaveCount(2)
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('import-dialog')).toBeHidden({ timeout: 60_000 })
    await page.goto('/')
    await expect(page.getByTestId('score-card')).toHaveCount(2)
  })
})
