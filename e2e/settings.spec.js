import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { makePdf, importPdfViaUi, readTable, collectErrors } from './helpers.js'

test.describe('Inställningar & säkerhetskopia', () => {
  test('toggles persist; backup export → clear → import restores the library', async ({ page }) => {
    const errors = collectErrors(page)
    await importPdfViaUi(page, await makePdf(2), 'Backup_Test.pdf')

    await page.goto('/installningar')
    const penOnly = page.getByTestId('setting-penOnly')
    await expect(penOnly).toBeVisible()
    await penOnly.click()
    await expect.poll(async () => (await readTable(page, 'settings')).find((s) => s.key === 'penOnly')?.value).toBe(true)

    // export
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByTestId('export-backup').click()])
    const zipPath = await download.path()
    const zip = unzipSync(new Uint8Array(await fs.readFile(zipPath)))
    const names = Object.keys(zip)
    expect(names).toContain('manifest.json')
    expect(names.some((n) => n.startsWith('files/') && n.endsWith('.pdf'))).toBe(true)
    const manifest = JSON.parse(strFromU8(zip['manifest.json']))
    expect(manifest.app).toBe('notstall')

    // clear everything with typed confirmation
    await page.getByTestId('clear-data').click()
    await page.getByTestId('clear-data-confirm-input').fill('RADERA')
    await page.getByTestId('clear-data-confirm').click()
    await expect.poll(async () => (await readTable(page, 'scores')).length).toBe(0)

    // import the backup back
    await page.goto('/installningar')
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-backup').click()])
    await chooser.setFiles({ name: 'notstall-backup.zip', mimeType: 'application/zip', buffer: await fs.readFile(zipPath) })
    await page.getByTestId('import-backup-confirm').click()
    await expect.poll(async () => (await readTable(page, 'scores')).length, { timeout: 30_000 }).toBe(1)
    const [score] = await readTable(page, 'scores')
    expect(score.title).toBe('Backup Test')
    expect((await readTable(page, 'files'))[0].data).toMatch(/ArrayBuffer/)

    await page.goto('/')
    await expect(page.getByTestId('score-card')).toHaveCount(1)
    expect(errors).toEqual([])
  })
})
