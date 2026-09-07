// A pdf.js-compatible PageViewport that needs no loaded document: built from the
// page's viewBox, userUnit and rotation (stored with every cached page image), so
// the viewer and the annotation layer can lay out a page before – or without –
// parsing the PDF. The transform math mirrors pdf.js' PageViewport exactly, so
// coordinates stored in PDF user space map identically whichever viewport is used.

function applyTransform(p, m) {
  const p0 = p[0]
  const p1 = p[1]
  p[0] = p0 * m[0] + p1 * m[2] + m[4]
  p[1] = p0 * m[1] + p1 * m[3] + m[5]
}

function applyInverseTransform(p, m) {
  const p0 = p[0]
  const p1 = p[1]
  const d = m[0] * m[3] - m[1] * m[2]
  p[0] = (p0 * m[3] - p1 * m[2] + m[2] * m[5] - m[4] * m[3]) / d
  p[1] = (-p0 * m[1] + p1 * m[0] + m[4] * m[1] - m[5] * m[0]) / d
}

export class Viewport {
  /**
   * @param {object} o
   * @param {number[]} o.viewBox   [x0, y0, x1, y1] in PDF user space
   * @param {number} [o.userUnit]  PDF /UserUnit (1 = points)
   * @param {number} o.scale       CSS px per PDF unit
   * @param {number} o.rotation    total rotation (intrinsic /Rotate + user rotation), multiple of 90
   */
  constructor({ viewBox, userUnit = 1, scale, rotation }) {
    this.viewBox = viewBox
    this.userUnit = userUnit
    this.scale = scale
    this.rotation = rotation
    this.offsetX = 0
    this.offsetY = 0
    const s = scale * userUnit
    const centerX = (viewBox[2] + viewBox[0]) / 2
    const centerY = (viewBox[3] + viewBox[1]) / 2
    let r = rotation % 360
    if (r < 0) r += 360
    let a
    let b
    let c
    let d
    switch (r) {
      case 180:
        a = -1
        b = 0
        c = 0
        d = 1
        break
      case 90:
        a = 0
        b = 1
        c = 1
        d = 0
        break
      case 270:
        a = 0
        b = -1
        c = -1
        d = 0
        break
      case 0:
        a = 1
        b = 0
        c = 0
        d = -1
        break
      default:
        throw new Error('Viewport: rotation must be a multiple of 90 degrees.')
    }
    let offsetCanvasX
    let offsetCanvasY
    let width
    let height
    if (a === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * s
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * s
      width = (viewBox[3] - viewBox[1]) * s
      height = (viewBox[2] - viewBox[0]) * s
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * s
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * s
      width = (viewBox[2] - viewBox[0]) * s
      height = (viewBox[3] - viewBox[1]) * s
    }
    this.transform = [a * s, b * s, c * s, d * s, offsetCanvasX - a * s * centerX - c * s * centerY, offsetCanvasY - b * s * centerX - d * s * centerY]
    this.width = width
    this.height = height
  }

  convertToViewportPoint(x, y) {
    const p = [x, y]
    applyTransform(p, this.transform)
    return p
  }

  convertToPdfPoint(x, y) {
    const p = [x, y]
    applyInverseTransform(p, this.transform)
    return p
  }
}

/** Page metadata that fully determines its geometry: { viewBox, userUnit, rotate }. */
export function pageMetaOf(page) {
  return { viewBox: Array.from(page.view), userUnit: page.userUnit || 1, rotate: page.rotate || 0 }
}

/** Total rotation of a page given its intrinsic /Rotate and the user's extra rotation. */
export function totalRotation(meta, extra = 0) {
  return ((((meta?.rotate || 0) + (extra || 0)) % 360) + 360) % 360
}

/** Viewport for page metadata at a scale with the user's extra rotation applied. */
export function viewportFromMeta(meta, { scale = 1, rotation = 0 } = {}) {
  return new Viewport({ viewBox: meta.viewBox, userUnit: meta.userUnit || 1, scale, rotation: totalRotation(meta, rotation) })
}

/** Displayed width/height (CSS px at scale 1) of a page from its metadata. */
export function baseSizeFromMeta(meta, rotation = 0) {
  const vp = viewportFromMeta(meta, { scale: 1, rotation })
  return { width: vp.width, height: vp.height }
}

/** Scale that fits page metadata inside a box. */
export function fitScaleFromMeta(meta, rotation, boxWidth, boxHeight, mode = 'page') {
  const { width, height } = baseSizeFromMeta(meta, rotation)
  if (!width || !height || !boxWidth) return 1
  if (mode === 'width') return boxWidth / width
  return Math.min(boxWidth / width, (boxHeight || Infinity) / height)
}
