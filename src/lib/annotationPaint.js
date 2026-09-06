// Shared annotation geometry + canvas painting. Used by the live overlay in the
// viewer and by the raster export. All stored coordinates are PDF user space;
// `viewport` (pdf.js PageViewport) maps them to CSS pixels.
import { uid } from './ids.js'

export const HIGHLIGHTER_OPACITY = 0.38
export const TEXT_FONT_FAMILY = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'

export const PEN_COLORS = ['#1d4ed8', '#111827', '#b91c1c', '#15803d', '#7c3aed', '#c2410c']
export const HIGHLIGHTER_COLORS = ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c']
export const PEN_WIDTHS = [1, 1.6, 2.6, 4]
export const HIGHLIGHTER_WIDTHS = [8, 12, 18]
export const TEXT_SIZES = [9, 12, 16, 22]

export function makeStroke({ tool = 'pen', color = '#1d4ed8', width = 1.6, opacity } = {}) {
  return {
    id: uid(),
    tool,
    color,
    width,
    opacity: typeof opacity === 'number' ? opacity : tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1,
    points: [],
  }
}

export function makeText({ x, y, text = '', color = '#b91c1c', size = 12 }) {
  return { id: uid(), x, y, text, color, size }
}

/**
 * Append a point (PDF user space) unless it is (almost) identical to the last one.
 * `minDist` in PDF units keeps stroke arrays compact.
 */
export function appendPoint(stroke, px, py, minDist = 0.35) {
  const pts = stroke.points
  const n = pts.length
  if (n >= 2) {
    const dx = px - pts[n - 2]
    const dy = py - pts[n - 1]
    if (dx * dx + dy * dy < minDist * minDist) return false
  }
  pts.push(px, py)
  return true
}

/** Convert a CSS-pixel point (relative to the page element) to PDF user space. */
export function cssToPdf(viewport, cssX, cssY) {
  return viewport.convertToPdfPoint(cssX, cssY)
}

/** Convert a PDF user-space point to CSS pixels (relative to the page element). */
export function pdfToCss(viewport, px, py) {
  return viewport.convertToViewportPoint(px, py)
}

function setupCtx(ctx, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/** Paint one stroke onto a 2d context whose CSS-size equals the viewport. */
export function paintStroke(ctx, viewport, stroke, dpr = 1) {
  const pts = stroke.points
  if (!pts || pts.length < 2) return
  setupCtx(ctx, dpr)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color || '#000'
  ctx.lineWidth = Math.max(0.5, (stroke.width || 1) * viewport.scale)
  const isHl = stroke.tool === 'highlighter'
  ctx.globalAlpha = typeof stroke.opacity === 'number' ? stroke.opacity : isHl ? HIGHLIGHTER_OPACITY : 1
  ctx.globalCompositeOperation = isHl ? 'multiply' : 'source-over'
  ctx.beginPath()
  const [x0, y0] = viewport.convertToViewportPoint(pts[0], pts[1])
  if (pts.length === 2) {
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0, y0)
  } else if (pts.length === 4) {
    const [x1, y1] = viewport.convertToViewportPoint(pts[2], pts[3])
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
  } else {
    // quadratic smoothing through midpoints
    ctx.moveTo(x0, y0)
    let [px, py] = [x0, y0]
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const [x, y] = viewport.convertToViewportPoint(pts[i], pts[i + 1])
      const mx = (px + x) / 2
      const my = (py + y) / 2
      ctx.quadraticCurveTo(px, py, mx, my)
      px = x
      py = y
    }
    ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}

/** Paint one text note. */
export function paintText(ctx, viewport, t, dpr = 1) {
  if (!t.text) return
  setupCtx(ctx, dpr)
  ctx.save()
  const [x, y] = viewport.convertToViewportPoint(t.x, t.y)
  const px = Math.max(4, (t.size || 12) * viewport.scale)
  ctx.font = `500 ${px}px ${TEXT_FONT_FAMILY}`
  ctx.fillStyle = t.color || '#000'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const lines = String(t.text).split('\n')
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * px * 1.25))
  ctx.restore()
}

/**
 * Clear and repaint a whole annotation record (plus an optional in-progress stroke).
 * The canvas must be sized viewport.width*dpr × viewport.height*dpr.
 */
export function paintAnnotation(ctx, viewport, annotation, { dpr = 1, liveStroke = null, clear = true } = {}) {
  setupCtx(ctx, dpr)
  if (clear) ctx.clearRect(0, 0, viewport.width, viewport.height)
  if (annotation) {
    for (const s of annotation.strokes || []) paintStroke(ctx, viewport, s, dpr)
    for (const t of annotation.texts || []) paintText(ctx, viewport, t, dpr)
  }
  if (liveStroke) paintStroke(ctx, viewport, liveStroke, dpr)
}

/** Measure a text note's CSS-pixel box (for hit testing / editing UI). */
export function measureText(ctx, viewport, t) {
  const px = Math.max(4, (t.size || 12) * viewport.scale)
  ctx.save()
  ctx.font = `500 ${px}px ${TEXT_FONT_FAMILY}`
  const lines = String(t.text || '').split('\n')
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), px)
  ctx.restore()
  const [x, y] = viewport.convertToViewportPoint(t.x, t.y)
  return { x, y: y - px, width, height: px * 1.25 * lines.length }
}

// ── Hit testing (eraser / text selection) ───────────────────────────────────

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx
  const y = ay + t * dy
  return Math.hypot(px - x, py - y)
}

// PDF-space bounding box per stroke, cached on the (immutable) stroke object so the
// eraser can skip most strokes with four comparisons instead of walking their points.
const strokeBounds = new WeakMap()
function boundsOf(stroke) {
  const pts = stroke.points
  let b = strokeBounds.get(stroke)
  if (b && b.n === pts.length) return b
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = pts[i]
    const y = pts[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  b = { minX, minY, maxX, maxY, n: pts.length }
  strokeBounds.set(stroke, b)
  return b
}

/** Is the CSS point within `radiusCss` px of the stroke (accounting for its width)? */
export function strokeHit(stroke, viewport, cssX, cssY, radiusCss = 10) {
  const pts = stroke.points
  if (!pts || pts.length < 2) return false
  // The viewport transform is a similarity (uniform scale, rotation, flip), so distances
  // compare equally well in PDF user space: convert the pointer once instead of every
  // stroke point (no per-point array allocations while erasing at pen event rate).
  const t = viewport.transform
  const k = Math.hypot(t[0], t[1]) || 1 // CSS px per PDF unit (scale × userUnit)
  const r = (radiusCss + ((stroke.width || 1) * viewport.scale) / 2) / k
  const [px, py] = viewport.convertToPdfPoint(cssX, cssY)
  const b = boundsOf(stroke)
  if (px < b.minX - r || px > b.maxX + r || py < b.minY - r || py > b.maxY + r) return false
  if (pts.length === 2) return Math.hypot(px - pts[0], py - pts[1]) <= r
  for (let i = 2; i + 1 < pts.length; i += 2) {
    if (distToSegment(px, py, pts[i - 2], pts[i - 1], pts[i], pts[i + 1]) <= r) return true
  }
  return false
}

export function textHit(ctx, viewport, t, cssX, cssY, pad = 6) {
  const box = measureText(ctx, viewport, t)
  return cssX >= box.x - pad && cssX <= box.x + box.width + pad && cssY >= box.y - pad && cssY <= box.y + box.height + pad
}
