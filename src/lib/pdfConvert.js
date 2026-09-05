// Rasterisation helpers: turn PDF pages into JPEG images and back into a
// (flattened) image PDF. Used for encrypted PDFs (pdf-lib cannot edit them)
// and for "export as images".
import { getPageBaseSize, renderPage } from './pdf.js'
import { imagesToPdf } from './pdfEdit.js'
import { paintAnnotation } from './annotationPaint.js'

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte skapa bild.'))), 'image/jpeg', quality)
  })
}

/**
 * Render pages to JPEG.
 * @param {*} doc pdf.js document
 * @param {object} opts
 * @param {number[]} [opts.pageOrder]   source indices in display order (default all)
 * @param {Record<number,number>} [opts.rotations]
 * @param {Map<number,object>|null} [opts.annotations]  pageIndex → annotation to burn in
 * @param {number} [opts.maxSide=2200]  longest side in pixels
 * @param {number} [opts.quality=0.86]
 * @param {(done:number,total:number)=>void} [opts.onProgress]
 * @returns {Promise<{bytes:ArrayBuffer,width:number,height:number,mime:'image/jpeg'}[]>}
 */
export async function rasterizePages(doc, { pageOrder, rotations = {}, annotations = null, maxSide = 2200, quality = 0.86, onProgress } = {}) {
  const order = pageOrder || Array.from({ length: doc.numPages }, (_, i) => i)
  const out = []
  const canvas = document.createElement('canvas')
  for (let i = 0; i < order.length; i++) {
    const srcIndex = order[i]
    const page = await doc.getPage(srcIndex + 1)
    const rotation = rotations[srcIndex] || 0
    const base = getPageBaseSize(page, rotation)
    const scale = maxSide / Math.max(base.width, base.height)
    const { task, viewport } = renderPage(page, canvas, { scale, rotation, dpr: 1 })
    await task.promise
    const ann = annotations?.get(srcIndex)
    if (ann && ((ann.strokes && ann.strokes.length) || (ann.texts && ann.texts.length))) {
      const ctx = canvas.getContext('2d')
      paintAnnotation(ctx, viewport, ann, { dpr: 1, clear: false })
    }
    const blob = await canvasToJpeg(canvas, quality)
    out.push({ bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height, mime: 'image/jpeg' })
    page.cleanup()
    onProgress?.(i + 1, order.length)
  }
  canvas.width = 0
  canvas.height = 0
  return out
}

/** Flatten a document to an image-only PDF (ArrayBuffer). */
export async function rasterizeToPdf(doc, opts = {}) {
  const images = await rasterizePages(doc, opts)
  return imagesToPdf(images)
}
