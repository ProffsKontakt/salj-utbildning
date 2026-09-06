// Cloud accounts + sync, exercised against the in-memory fake cloud that the
// dev server on :4175 exposes (NOTSTALL_FAKE_CLOUD=1). Two browser contexts act
// as two devices signed in to the same account.
import { test, expect } from '@playwright/test'
import { makePdf, importPdfViaUi, waitForRenderedPage, paintedFraction, dragAcross, readTable, collectErrors } from './helpers.js'

async function signIn(page, email, password = 'hemligt-losen') {
  await page.goto('/konto')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('account-card')).toBeVisible({ timeout: 30_000 })
}

async function waitSynced(page) {
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const s = window.__notstallSync
          if (!s?.user) return 'no-user'
          return `${s.status.phase}:${s.status.pending}`
        })
      },
      { timeout: 60_000, message: 'sync should settle to idle with 0 pending' },
    )
    .toBe('idle:0')
}

async function syncNow(page) {
  await page.evaluate(() => window.__notstallSync.syncNow())
  await waitSynced(page)
}

test.describe('Konto & molnsynk (fejkat moln)', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/__cloud/reset')
  })

  test('two devices: upload, download on open, annotations both ways, delete propagates', async ({ browser, page }) => {
    const errorsA = collectErrors(page)
    const email = `duo-${Date.now()}@test.se`

    // Device A: local library first, then sign in and upload it.
    const id = await importPdfViaUi(page, await makePdf(2), 'Moln_A.pdf')
    await waitForRenderedPage(page)
    await signIn(page, email)
    await expect(page.getByTestId('adopt-upload')).toBeVisible()
    await page.getByTestId('adopt-upload').click()
    await waitSynced(page)
    let rows = await readTable(page, 'scores')
    expect(rows[0].ownerId).toBeTruthy()
    expect(rows[0].dirty).toBe(0)
    expect(rows[0].remoteFileVersion).toBeGreaterThan(0)

    // Draw on page 1 and let it sync.
    await page.goto(`/noter/${id}`)
    await waitForRenderedPage(page)
    await page.getByTestId('tool-pen').click()
    await dragAcross(page, page.getByTestId('annotation-canvas'), 0.2, 0.2, 0.7, 0.6)
    await expect.poll(async () => (await readTable(page, 'annotations')).length).toBe(1)
    await page.goto('/konto')
    await waitSynced(page)

    // Device B: same account, empty device.
    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    const errorsB = collectErrors(pageB)
    await signIn(pageB, email)
    await waitSynced(pageB)
    await pageB.goto('/')
    const card = pageB.getByTestId('score-card')
    await expect(card).toHaveCount(1)
    await expect(card.first()).toHaveAttribute('data-cloud', 'true')
    await expect(card.first()).toHaveAttribute('data-downloaded', 'false')
    expect((await readTable(pageB, 'files')).length).toBe(0)

    // Opening downloads the PDF, then renders with the synced stroke.
    await pageB.goto(`/noter/${id}`)
    await waitForRenderedPage(pageB)
    expect((await readTable(pageB, 'files')).length).toBe(1)
    await expect.poll(() => paintedFraction(pageB.getByTestId('annotation-canvas'))).toBeGreaterThan(0)
    const annB = await readTable(pageB, 'annotations')
    expect(annB).toHaveLength(1)
    expect(annB[0].strokes).toHaveLength(1)

    // B adds a second stroke; A receives it.
    await pageB.getByTestId('tool-pen').click()
    await dragAcross(pageB, pageB.getByTestId('annotation-canvas'), 0.1, 0.8, 0.9, 0.8)
    await expect.poll(async () => (await readTable(pageB, 'annotations'))[0].strokes.length).toBe(2)
    await pageB.goto('/konto')
    await waitSynced(pageB)

    await page.goto('/konto')
    await syncNow(page)
    await expect.poll(async () => (await readTable(page, 'annotations'))[0]?.strokes.length).toBe(2)

    // B deletes the score; A's copy disappears on the next sync.
    await pageB.goto('/')
    await pageB.getByTestId('score-card').first().getByTestId('score-menu').click()
    await pageB.getByRole('menuitem', { name: /Ta bort/ }).click()
    await pageB.getByRole('dialog').getByRole('button', { name: /Ta bort/ }).click()
    await expect(pageB.getByTestId('score-card')).toHaveCount(0)
    await pageB.goto('/konto')
    await waitSynced(pageB)

    await page.goto('/konto')
    await syncNow(page)
    await page.goto('/')
    await expect(page.getByTestId('score-card')).toHaveCount(0)
    rows = await readTable(page, 'scores')
    expect(rows).toHaveLength(0)
    expect((await readTable(page, 'files')).length).toBe(0)

    expect(errorsA).toEqual([])
    expect(errorsB).toEqual([])
    await ctxB.close()
  })

  test('projects sync, download all, offline gate, sign-out clears the device', async ({ browser, page }) => {
    const email = `proj-${Date.now()}@test.se`
    await signIn(page, email)
    const idA = await importPdfViaUi(page, await makePdf(1), 'Alfa.pdf')
    const idB = await importPdfViaUi(page, await makePdf(2), 'Beta.pdf')
    await page.goto('/projekt')
    await page.getByTestId('new-project').click()
    await page.getByTestId('project-name').fill('Turné')
    await page.getByTestId('project-save').click()
    await page.waitForURL(/\/projekt\/[^/]+$/)
    const projectUrl = page.url()
    await page.getByTestId('add-scores').click()
    await page.getByTestId('picker-item').nth(0).click()
    await page.getByTestId('picker-item').nth(1).click()
    await page.getByTestId('picker-confirm').click()
    await expect(page.getByTestId('setlist-item')).toHaveCount(2)
    await page.goto('/konto')
    await waitSynced(page)

    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    const errorsB = collectErrors(pageB)
    await signIn(pageB, email)
    await waitSynced(pageB)
    await pageB.goto(projectUrl)
    await expect(pageB.getByTestId('setlist-item')).toHaveCount(2)
    await expect(pageB.getByTestId('setlist-item').first()).toHaveAttribute('data-downloaded', 'false')

    // Offline: a cloud-only score cannot be opened, the button explains why.
    await ctxB.setOffline(true)
    await pageB.goto(`/noter/${idA}`)
    await expect(pageB.getByTestId('download-needed')).toBeVisible()
    await expect(pageB.getByTestId('download-score-now')).toBeDisabled()
    await ctxB.setOffline(false)
    await pageB.getByTestId('download-score-now').click()
    await waitForRenderedPage(pageB)

    // Download everything in the project.
    await pageB.goto(projectUrl)
    await pageB.getByTestId('download-project').click()
    await expect.poll(async () => (await readTable(pageB, 'files')).length).toBe(2)
    await expect(pageB.getByTestId('setlist-item').nth(1)).toHaveAttribute('data-downloaded', 'true')

    // Remove one download from the library card menu.
    await pageB.goto('/')
    const cardB = pageB.getByTestId('score-card').filter({ hasText: 'Beta' })
    await cardB.getByTestId('score-menu').click()
    await pageB.getByTestId('remove-download').click()
    await expect(cardB).toHaveAttribute('data-downloaded', 'false')
    expect((await readTable(pageB, 'files')).length).toBe(1)

    // Sign out and clear the device: nothing left locally, cloud copy intact.
    await pageB.goto('/konto')
    await pageB.getByTestId('sign-out').click()
    await pageB.getByTestId('sign-out-confirm').click()
    await expect(pageB.getByTestId('login-card')).toBeVisible()
    expect((await readTable(pageB, 'scores')).length).toBe(0)
    expect((await readTable(pageB, 'files')).length).toBe(0)
    await signIn(pageB, email)
    await waitSynced(pageB)
    await pageB.goto('/')
    await expect(pageB.getByTestId('score-card')).toHaveCount(2)
    expect(errorsB).toEqual([])
    expect([idA, idB]).toHaveLength(2)
    await ctxB.close()
  })

  test('offline edits queue and upload when back online', async ({ page, context }) => {
    const email = `offline-${Date.now()}@test.se`
    await signIn(page, email)
    const id = await importPdfViaUi(page, await makePdf(1), 'Offline.pdf')
    await page.goto('/konto')
    await waitSynced(page)

    await context.setOffline(true)
    await page.goto(`/noter/${id}`)
    await waitForRenderedPage(page)
    await page.getByTestId('tool-pen').click()
    await dragAcross(page, page.getByTestId('annotation-canvas'), 0.2, 0.3, 0.6, 0.6)
    await expect.poll(async () => (await readTable(page, 'annotations')).length).toBe(1)
    await page.goto('/konto')
    await expect(page.getByTestId('sync-status')).toHaveAttribute('data-phase', /offline|idle|error/)
    await expect.poll(() => page.evaluate(() => window.__notstallSync.status.pending)).toBeGreaterThan(0)

    await context.setOffline(false)
    await syncNow(page)
    // The fake cloud now holds the annotation: a fresh context sees it.
    const rows = await page.request.get('/__cloud/pull?table=annotations&since=1970-01-01T00:00:00.000Z', {
      headers: { 'x-user': await page.evaluate(() => window.__notstallSync.user.id) },
    })
    const remote = await rows.json()
    expect(remote).toHaveLength(1)
    expect(remote[0].strokes).toHaveLength(1)
  })
})
