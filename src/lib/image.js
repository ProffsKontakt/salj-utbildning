// Camera / image import helpers: decode, downscale, optionally "scan-enhance",
// and encode as JPEG for embedding into a PDF.

const MAX_SIDE_DEFAULT = 2200

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bilden kunde inte läsas. Formatet stöds inte av webbläsaren.'))
    img.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kunde inte skapa bild.'))), type, quality)
  })
}

/**
 * Grayscale + auto-levels + mild gamma: makes a phone photo of a page look
 * like a clean scan. Operates in place on ImageData.
 */
export function enhanceScan(imageData) {
  const d = imageData.data
  const n = d.length / 4
  const hist = new Uint32Array(256)
  const lum = new Uint8ClampedArray(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const y = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000
    lum[i] = y
    hist[y | 0]++
  }
  // percentile clipping (0.5% dark, 1% bright) for contrast stretch
  const loCount = n * 0.005
  const hiCount = n * 0.99
  let acc = 0
  let lo = 0
  let hi = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= loCount) {
      lo = v
      break
    }
  }
  acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= hiCount) {
      hi = v
      break
    }
  }
  if (hi - lo < 40) {
    lo = Math.max(0, lo - 20)
    hi = Math.min(255, hi + 20)
  }
  const range = Math.max(1, hi - lo)
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    let t = (v - lo) / range
    t = Math.min(1, Math.max(0, t))
    // gentle S-curve: whiten paper, keep ink dark
    t = Math.pow(t, 1.15)
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    lut[v] = Math.round(t * 255)
  }
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = lut[lum[i]]
    d[p] = v
    d[p + 1] = v
    d[p + 2] = v
    d[p + 3] = 255
  }
  return imageData
}

/**
 * Convert an image File/Blob to a downscaled JPEG.
 * @returns {Promise<{bytes: ArrayBuffer, width: number, height: number, mime: 'image/jpeg'}>}
 */
export async function imageFileToJpeg(file, { maxSide = MAX_SIDE_DEFAULT, enhance = false, quality = 0.86 } = {}) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(url)
    const sw = img.naturalWidth || img.width
    const sh = img.naturalHeight || img.height
    if (!sw || !sh) throw new Error('Bilden är tom.')
    const s = Math.min(1, maxSide / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * s))
    const h = Math.max(1, Math.round(sh * s))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: enhance })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    if (enhance) {
      const data = ctx.getImageData(0, 0, w, h)
      enhanceScan(data)
      ctx.putImageData(data, 0, 0)
    }
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    canvas.width = 0
    canvas.height = 0
    return { bytes: await blob.arrayBuffer(), width: w, height: h, mime: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Small JPEG preview (data URL) of an image file, for thumbnails in the scan sheet. */
export async function imageFilePreview(file, { maxSide = 320, enhance = false } = {}) {
  const { bytes } = await imageFileToJpeg(file, { maxSide, enhance, quality: 0.8 })
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))
}

export const IMAGE_MIME_RE = /^image\//i
export const PDF_MIME_RE = /^application\/(x-)?pdf$/i

export function isPdfFile(file) {
  return PDF_MIME_RE.test(file.type) || /\.pdf$/i.test(file.name || '')
}

export function isImageFile(file) {
  return IMAGE_MIME_RE.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name || '')
}
