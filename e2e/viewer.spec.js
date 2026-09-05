import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs/promises'
import { makePdf, importPdfViaUi, waitForRenderedPage, nonWhiteFraction, paintedFraction, currentPageBox, dragAcross, readTable, collectErrors, PAGE_SIZES, aspect } from './helpers.js'

test.describe('Visare & annotering', () => {
  test('renders pages, navigates, draws a persistent stroke, undo, export', async ({ page }) => {
    const errors = collectErrors(page)
    const id = await importPdfViaUi(page, await makePdf(3), 'Panis_Angelicus.pdf')

    // first page rendered with real content
    const first = await waitForRenderedPage(page)
    expect(await nonWhiteFraction(first)).toBeGreaterThan(0.02)
    let box = await currentPageBox(page)
    expect(box.sourceIndex).toBe(0)
    expect(Math.abs(box.ratio - aspect(PAGE_SIZES[0]))).toBeLessThan(0.05)
    await expect(page.getByTestId('page-indicator')).toContainText('1 / 3')

    // next / prev via buttons and keyboard
    await page.getByTestId('page-next').click()
    await expect(page.getByTestId('page-indicator')).toContainText('2 / 3')
    box = await currentPageBox(page)
    expect(box.sourceIndex).toBe(1)
    expect(Math.abs(box.ratio - aspect(PAGE_SIZES[1]))).toBeLessThan(0.05)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('page-indicator')).toContainText('3 / 3')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('page-indicator')).toContainText('1 / 3')

    // draw with the pen
    await page.getByTestId('tool-pen').click()
    const canvas = page.getByTestId('annotation-canvas')
    await expect(canvas).toBeVisible()
    expect(await paintedFraction(canvas)).toBe(0)
    await dragAcross(page, canvas, 0.2, 0.2, 0.8, 0.7)
    await expect.poll(() => paintedFraction(canvas)).toBeGreaterThan(0.001)

    // persisted in PDF user space
    await expect
      .poll(async () => (await readTable(page, 'annotations')).length, { timeout: 10_000 })
      .toBe(1)
    const [ann] = await readTable(page, 'annotations')
    expect(ann.scoreId).toBe(id)
    expect(ann.pageIndex).toBe(0)
    expect(ann.strokes).toHaveLength(1)
    const pts = ann.strokes[0].points
    expect(pts.length).toBeGreaterThan(4)
    const [w, h] = PAGE_SIZES[0]
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(-1)
      expect(pts[i]).toBeLessThanOrEqual(w + 1)
      expect(pts[i + 1]).toBeGreaterThanOrEqual(-1)
      expect(pts[i + 1]).toBeLessThanOrEqual(h + 1)
    }
    // stroke goes from upper-left to lower-right on screen → PDF y decreases
    expect(pts[1]).toBeGreaterThan(pts[pts.length - 1])

    // survives reload
    await page.reload()
    await waitForRenderedPage(page)
    await expect.poll(() => paintedFraction(page.getByTestId('annotation-canvas'))).toBeGreaterThan(0.001)

    // highlighter + undo (the viewer reopens in read mode: the pen button enters draw mode)
    await page.getByTestId('tool-pen').click()
    await page.getByTestId('tool-highlighter').click()
    await dragAcross(page, page.getByTestId('annotation-canvas'), 0.1, 0.5, 0.9, 0.5)
    await expect.poll(async () => (await readTable(page, 'annotations'))[0].strokes.length).toBe(2)
    await page.getByTestId('undo').click()
    await expect.poll(async () => (await readTable(page, 'annotations'))[0].strokes.length).toBe(1)
    await page.getByTestId('redo').click()
    await expect.poll(async () => (await readTable(page, 'annotations'))[0].strokes.length).toBe(2)

    // eraser removes strokes
    await page.getByTestId('tool-eraser').click()
    await dragAcross(page, page.getByTestId('annotation-canvas'), 0.1, 0.5, 0.9, 0.5, 30)
    await expect.poll(async () => (await readTable(page, 'annotations'))[0]?.strokes.length ?? 0).toBeLessThan(2)

    // export with annotations → downloaded PDF has 3 pages in order
    await page.getByTestId('tool-read').click()
    await page.getByTestId('viewer-menu').click()
    await page.getByTestId('export-pdf').click()
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByTestId('export-confirm').click()])
    const path = await download.path()
    const bytes = await fs.readFile(path)
    const out = await PDFDocument.load(bytes)
    expect(out.getPageCount()).toBe(3)
    const sizes = out.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])
    expect(sizes).toEqual(PAGE_SIZES.slice(0, 3))
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    expect(errors).toEqual([])
  })

  test('text tool adds a note that is saved', async ({ page }) => {
    await importPdfViaUi(page, await makePdf(1), 'Text.pdf')
    await waitForRenderedPage(page)
    await page.getByTestId('tool-pen').click() // enter draw mode
    await page.getByTestId('tool-text').click()
    const canvas = page.getByTestId('annotation-canvas')
    const box = await canvas.boundingBox()
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)
    const editor = page.locator('textarea:visible, input[type="text"]:visible').last()
    await editor.fill('Andas här')
    await page.getByRole('button', { name: /^Klar$/ }).click()
    await expect.poll(async () => (await readTable(page, 'annotations'))[0]?.texts?.length ?? 0).toBe(1)
    const [ann] = await readTable(page, 'annotations')
    expect(ann.texts[0].text).toBe('Andas här')
    await expect.poll(() => paintedFraction(canvas)).toBeGreaterThan(0)
  })
})
