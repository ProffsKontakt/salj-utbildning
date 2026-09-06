// pdf-lib based editing: images → PDF, append pages, export with baked-in annotations.
import {
  PDFDocument,
  StandardFonts,
  LineCapStyle,
  LineJoinStyle,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  setGraphicsState,
  setLineWidth,
  setLineCap,
  setLineJoin,
  setStrokingColor,
  moveTo,
  lineTo,
  stroke,
} from 'pdf-lib'
import { toArrayBuffer } from './bytes.js'

const LOAD_OPTS = { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }

export const HIGHLIGHTER_OPACITY = 0.38

// Max operators per page.pushOperators() call (see drawAnnotations).
const OPS_CHUNK = 2000

/** '#rrggbb' → [r,g,b] in 0..1 */
export function hexToRgb01(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Build a PDF where each image becomes one page. The page keeps the image's
 * aspect ratio with the longer side equal to A4's long side (842 pt), so a
 * portrait photo becomes a near-A4 page with no margins.
 * @param {{bytes: ArrayBuffer, mime: 'image/jpeg'|'image/png'}[]} images
 * @returns {Promise<ArrayBuffer>}
 */
export async function imagesToPdf(images) {
  if (!images?.length) throw new Error('Inga bilder att skapa PDF från.')
  const doc = await PDFDocument.create()
  doc.setProducer('Notställ')
  doc.setCreator('Notställ')
  for (const img of images) {
    const embedded = img.mime === 'image/png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes)
    const { width, height } = embedded
    const s = 842 / Math.max(width, height)
    const pw = Math.round(width * s * 100) / 100
    const ph = Math.round(height * s * 100) / 100
    const page = doc.addPage([pw, ph])
    page.drawImage(embedded, { x: 0, y: 0, width: pw, height: ph })
  }
  return toArrayBuffer(await doc.save({ useObjectStreams: true }))
}

/**
 * Append all pages of `extraBytes` to `baseBytes`.
 * @returns {Promise<{bytes: ArrayBuffer, added: number, total: number}>}
 */
export async function appendPdf(baseBytes, extraBytes) {
  const base = await PDFDocument.load(baseBytes, LOAD_OPTS)
  const extra = await PDFDocument.load(extraBytes, LOAD_OPTS)
  if (base.isEncrypted || extra.isEncrypted) {
    const err = new Error('PDF-filen är krypterad och kan inte redigeras direkt.')
    err.code = 'ENCRYPTED'
    throw err
  }
  const indices = extra.getPageIndices()
  const copied = await base.copyPages(extra, indices)
  for (const p of copied) base.addPage(p)
  return { bytes: toArrayBuffer(await base.save({ useObjectStreams: true })), added: indices.length, total: base.getPageCount() }
}

// Musical symbols that WinAnsi lacks → readable ASCII stand-ins.
const SYMBOL_MAP = { '♯': '#', '♭': 'b', '♮': 'n', '𝄞': 'G', '𝄢': 'F', '→': '->', '←': '<-', '✓': 'v', '★': '*', '♪': '*', '♫': '*' }

/** Make text encodable by a pdf-lib standard (WinAnsi) font. */
export function toWinAnsi(text, font) {
  let out = ''
  for (const ch of String(text || '')) {
    if (ch === '\r') continue
    if (ch === '\t') {
      out += '  '
      continue
    }
    if (ch === '\n') {
      out += ch
      continue
    }
    if (SYMBOL_MAP[ch]) {
      out += SYMBOL_MAP[ch]
      continue
    }
    if (font) {
      try {
        font.encodeText(ch)
        out += ch
      } catch {
        out += '?'
      }
    } else {
      const c = ch.codePointAt(0)
      out += (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) ? ch : '?'
    }
  }
  return out
}

/**
 * Export a copy of the score's PDF with pages in display order, extra rotations
 * applied and annotations drawn into the page content.
 *
 * @param {object} args
 * @param {ArrayBuffer} args.srcBytes         original PDF bytes
 * @param {number[]} args.pageOrder           source page indices in display order
 * @param {Record<number, number>} [args.rotations]  extra rotation per source page
 * @param {Map<number, object>} [args.annotations]   pageIndex → annotation record
 * @param {boolean} [args.includeAnnotations=true]
 * @param {string} [args.title]
 * @param {string} [args.author]
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildExportPdf({ srcBytes, pageOrder, rotations = {}, annotations = new Map(), includeAnnotations = true, title = '', author = '' }) {
  if (!pageOrder?.length) throw new Error('Stycket har inga sidor att exportera.')
  const src = await PDFDocument.load(srcBytes, LOAD_OPTS)
  if (src.isEncrypted) {
    const err = new Error('PDF-filen är krypterad och kan inte redigeras direkt.')
    err.code = 'ENCRYPTED'
    throw err
  }
  const out = await PDFDocument.create()
  out.setProducer('Notställ')
  out.setCreator('Notställ')
  if (title) out.setTitle(title)
  if (author) out.setAuthor(author)
  const font = await out.embedFont(StandardFonts.Helvetica)

  const copied = await out.copyPages(src, pageOrder)
  for (let i = 0; i < copied.length; i++) {
    const page = copied[i]
    const srcIndex = pageOrder[i]
    const extra = rotations[srcIndex] || 0
    const baseRot = page.getRotation().angle || 0
    const effective = (((baseRot + extra) % 360) + 360) % 360
    if (extra) page.setRotation(degrees(effective))
    out.addPage(page)
    if (includeAnnotations) {
      const ann = annotations.get(srcIndex)
      if (ann) drawAnnotations(out, page, ann, effective, font)
    }
  }
  return toArrayBuffer(await out.save({ useObjectStreams: true }))
}

function drawAnnotations(doc, page, ann, effectiveRotation, font) {
  const ops = []
  const gsCache = new Map()
  for (const s of ann.strokes || []) {
    const pts = s.points
    if (!pts || pts.length < 2) continue
    const [r, g, b] = hexToRgb01(s.color)
    const alpha = typeof s.opacity === 'number' ? s.opacity : s.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1
    const blend = s.tool === 'highlighter' ? 'Multiply' : 'Normal'
    ops.push(pushGraphicsState())
    if (alpha < 1 || blend !== 'Normal') {
      const key = `${alpha.toFixed(3)}|${blend}`
      let name = gsCache.get(key)
      if (!name) {
        const gs = doc.context.obj({ Type: 'ExtGState', CA: alpha, ca: alpha, BM: blend })
        name = page.node.newExtGState('GS', gs)
        gsCache.set(key, name)
      }
      ops.push(setGraphicsState(name))
    }
    ops.push(setStrokingColor(rgb(r, g, b)), setLineWidth(Math.max(0.1, s.width || 1)), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round))
    ops.push(moveTo(pts[0], pts[1]))
    if (pts.length === 2) ops.push(lineTo(pts[0], pts[1]))
    for (let i = 2; i + 1 < pts.length; i += 2) ops.push(lineTo(pts[i], pts[i + 1]))
    ops.push(stroke(), popGraphicsState())
  }
  // pdf-lib spreads the operators into function arguments (pushOperators →
  // contentStream.push.apply → Array.prototype.push.apply); engines cap the
  // argument count (~65k in JavaScriptCore), so push in bounded chunks.
  for (let i = 0; i < ops.length; i += OPS_CHUNK) page.pushOperators(...ops.slice(i, i + OPS_CHUNK))

  for (const t of ann.texts || []) {
    const text = toWinAnsi(t.text, font)
    if (!text.trim()) continue
    const [r, g, b] = hexToRgb01(t.color)
    const size = Math.max(4, t.size || 12)
    page.drawText(text, {
      x: t.x,
      y: t.y,
      size,
      font,
      color: rgb(r, g, b),
      rotate: degrees(effectiveRotation),
      lineHeight: size * 1.25,
    })
  }
}
