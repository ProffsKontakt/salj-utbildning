import { test, expect } from '@playwright/test'
import { makePdf, importPdfViaUi, waitForRenderedPage, readTable, collectErrors } from './helpers.js'

test.describe('Projekt & konsertläge', () => {
  test('create project, add scores, reorder, perform through all pages', async ({ page }) => {
    const errors = collectErrors(page)
    const idA = await importPdfViaUi(page, await makePdf(2), 'Alfa.pdf')
    const idB = await importPdfViaUi(page, await makePdf(1), 'Beta.pdf')

    await page.goto('/projekt')
    await expect(page.getByText('Inga projekt ännu')).toBeVisible()
    await page.getByTestId('new-project').click()
    await page.getByTestId('project-name').fill('Julkonsert i Storkyrkan')
    await page.getByTestId('project-date').fill('2030-12-20')
    await page.getByTestId('project-venue').fill('Storkyrkan')
    await page.getByTestId('project-save').click()
    await page.waitForURL(/\/projekt\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Julkonsert i Storkyrkan' })).toBeVisible()
    await expect(page.getByTestId('start-performance')).toBeDisabled()

    // add both scores
    await page.getByTestId('add-scores').click()
    await expect(page.getByTestId('add-scores-dialog')).toBeVisible()
    await expect(page.getByTestId('picker-item')).toHaveCount(2)
    await page.getByTestId('picker-item').nth(0).click()
    await page.getByTestId('picker-item').nth(1).click()
    await page.getByTestId('picker-confirm').click()
    await expect(page.getByTestId('setlist-item')).toHaveCount(2)

    const orderBefore = await page.getByTestId('setlist-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-score-id')))
    expect(new Set(orderBefore)).toEqual(new Set([idA, idB]))

    // move first down
    await page.getByTestId('setlist-item').first().getByTestId('setlist-move-down').click()
    await expect
      .poll(() => page.getByTestId('setlist-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-score-id'))))
      .toEqual([orderBefore[1], orderBefore[0]])
    const links = await readTable(page, 'projectScores')
    const sorted = [...links].sort((a, b) => a.position - b.position).map((l) => l.scoreId)
    expect(sorted).toEqual([orderBefore[1], orderBefore[0]])

    // project card shows counts
    await page.goto('/projekt')
    const card = page.getByTestId('project-card').first()
    await expect(card).toContainText('Julkonsert i Storkyrkan')
    await expect(card).toContainText('2 stycken')
    await expect(card).toContainText('3 sidor')
    await card.click()

    // performance mode walks 3 pages across 2 scores
    await page.getByTestId('start-performance').click()
    await page.waitForURL(/\/spela/)
    await waitForRenderedPage(page, 'performance-stage')
    await expect(page.getByTestId('performance-title')).toBeVisible()
    await page.getByTestId('performance-next').click()
    await waitForRenderedPage(page, 'performance-stage')
    await page.getByTestId('performance-next').click()
    await waitForRenderedPage(page, 'performance-stage')
    // at the end: next is disabled, prev still works
    await expect(page.getByTestId('performance-next')).toBeDisabled()
    await page.getByTestId('performance-prev').click()
    await waitForRenderedPage(page, 'performance-stage')
    await page.getByTestId('performance-exit').click()
    await page.waitForURL(/\/projekt\/[^/]+$/)

    // remove one score from the project (undo toast appears)
    await page.getByTestId('setlist-item').first().getByTestId('remove-from-project').click()
    await expect(page.getByTestId('setlist-item')).toHaveCount(1)
    expect((await readTable(page, 'scores')).length).toBe(2) // scores are never deleted from a project action
    expect(errors).toEqual([])
  })

  test('add to project from the library card menu', async ({ page }) => {
    await importPdfViaUi(page, await makePdf(1), 'Gamma.pdf')
    await page.goto('/projekt')
    await page.getByTestId('new-project').click()
    await page.getByTestId('project-name').fill('Vårkonsert')
    await page.getByTestId('project-save').click()
    await page.waitForURL(/\/projekt\/[^/]+$/)

    await page.goto('/')
    await page.getByTestId('score-card').first().getByTestId('score-menu').click()
    await page.getByRole('menuitem', { name: /Lägg till i projekt/ }).click()
    await expect(page.getByTestId('add-to-project-dialog')).toBeVisible()
    await page.getByTestId('project-option').first().click()
    await page.getByTestId('add-to-project-confirm').click()
    await expect.poll(async () => (await readTable(page, 'projectScores')).length).toBe(1)
  })
})
