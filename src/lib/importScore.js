// Import orchestration: File[] → PDF bytes → score records.
import { createScore, replaceScoreFile, updateScore } from '../db/db.js'
import { imageFileToJpeg, isImageFile, isPdfFile } from './image.js'
import { imagesToPdf, appendPdf } from './pdfEdit.js'
import { loadPdfDocument, destroyPdfDocument, renderThumbnail, isEncryptedPdf, invalidateScoreDocument, describePdfError } from './pdf.js'
import { rasterizeToPdf } from './pdfConvert.js'
import { baseName } from './bytes.js'

/**
 * Group picked files into import items: every PDF becomes its own score,
 * all images together become one multi-page score.
 * @returns {{ kind:'pdf'|'images', files: File[], suggestedTitle: string }[]}
 */
export function planImport(files) {
  const items = []
  const images = []
  for (const f of files) {
    if (isPdfFile(f)) items.push({ kind: 'pdf', files: [f], suggestedTitle: prettifyTitle(baseName(f.name)) })
    else if (isImageFile(f)) images.push(f)
  }
  if (images.length) {
    const title = images.length === 1 ? prettifyTitle(baseName(images[0].name)) : ''
    items.push({ kind: 'images', files: images, suggestedTitle: title })
  }
  return items
}

export function prettifyTitle(name) {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turn an import item's files into PDF bytes.
 * Encrypted PDFs are flattened to images because they cannot be edited later.
 * @returns {Promise<{ bytes: ArrayBuffer, pageCount: number, flattened: boolean }>}
 */
export async function filesToPdfBytes(files, { enhance = false, onProgress } = {}) {
  const pdfs = files.filter(isPdfFile)
  const images = files.filter((f) => !isPdfFile(f) && isImageFile(f))
  if (pdfs.length && images.length) throw new Error('Blanda inte PDF och bilder i samma stycke.')
  if (pdfs.length > 1) throw new Error('Ett stycke kan bara skapas från en PDF åt gången.')

  if (pdfs.length === 1) {
    let bytes = await pdfs[0].arrayBuffer()
    let doc
    try {
      doc = await loadPdfDocument(bytes)
    } catch (err) {
      throw new Error(describePdfError(err))
    }
    try {
      let flattened = false
      if (await isEncryptedPdf(doc)) {
        bytes = await rasterizeToPdf(doc, { onProgress })
        flattened = true
        const check = await loadPdfDocument(bytes)
        const pageCount = check.numPages
        await destroyPdfDocument(check)
        return { bytes, pageCount, flattened }
      }
      return { bytes, pageCount: doc.numPages, flattened }
    } finally {
      await destroyPdfDocument(doc)
    }
  }

  if (!images.length) throw new Error('Inga filer som stöds valdes (PDF, JPEG, PNG, WebP).')
  const jpegs = []
  for (let i = 0; i < images.length; i++) {
    jpegs.push(await imageFileToJpeg(images[i], { enhance }))
    onProgress?.(i + 1, images.length)
  }
  const bytes = await imagesToPdf(jpegs)
  return { bytes, pageCount: jpegs.length, flattened: false }
}

/** Render the first page as a thumbnail. Never throws (returns null on failure). */
export async function makeThumbnailFromBytes(bytes, { pageIndex = 0, rotation = 0 } = {}) {
  let doc
  try {
    doc = await loadPdfDocument(bytes)
    return await renderThumbnail(doc, pageIndex, { rotation })
  } catch {
    return null
  } finally {
    if (doc) await destroyPdfDocument(doc)
  }
}

/**
 * Create a score from files (one PDF, or any number of images).
 * @returns {Promise<{ score: object, flattened: boolean }>}
 */
export async function importFilesAsScore(files, { title, composer = '', projectId = null, enhance = false, onProgress } = {}) {
  const { bytes, pageCount, flattened } = await filesToPdfBytes(files, { enhance, onProgress })
  const thumb = await makeThumbnailFromBytes(bytes)
  const score = await createScore({
    title: title || planImport(files)[0]?.suggestedTitle || defaultTitle(files),
    composer,
    pdfBytes: bytes,
    pageCount,
    thumb,
    fileName: files.length === 1 ? files[0].name : '',
    projectId,
  })
  return { score, flattened }
}

export function defaultTitle(files) {
  if (files?.length === 1) return prettifyTitle(baseName(files[0].name)) || 'Namnlöst stycke'
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `Skannat ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Append pages (from images or a PDF) to an existing score. New pages are added to
 * the end of pageOrder. The pdf.js document cache is invalidated; callers holding a
 * document should bump their `version`.
 * @returns {Promise<{ added: number, pageCount: number }>}
 */
export async function appendFilesToScore(score, file, files, { enhance = false, onProgress } = {}) {
  const { bytes: extraBytes, pageCount: extraCount } = await filesToPdfBytes(files, { enhance, onProgress })
  const { bytes, added, total } = await appendPdf(file.data, extraBytes)
  const start = score.pageCount
  const newIndices = Array.from({ length: added }, (_, i) => start + i)
  const pageOrder = [...(score.pageOrder || []), ...newIndices]
  const patch = { pdfBytes: bytes, pageCount: total, pageOrder, rotations: score.rotations || {} }
  if (!score.thumb || !score.pageOrder?.length) {
    patch.thumb = await makeThumbnailFromBytes(bytes, { pageIndex: pageOrder[0] ?? 0, rotation: (score.rotations || {})[pageOrder[0]] || 0 })
  }
  await replaceScoreFile(score.id, patch)
  invalidateScoreDocument(score.id)
  return { added: extraCount, pageCount: total }
}

/** Re-render and store the thumbnail for the first displayed page. */
export async function refreshThumbnail(score, fileBytes) {
  const first = score.pageOrder?.[0]
  if (first === undefined) {
    await updateScore(score.id, { thumb: null })
    return
  }
  const thumb = await makeThumbnailFromBytes(fileBytes, { pageIndex: first, rotation: (score.rotations || {})[first] || 0 })
  await updateScore(score.id, { thumb })
}
