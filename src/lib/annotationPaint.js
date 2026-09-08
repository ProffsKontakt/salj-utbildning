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

// Pen pressure → width. A light touch draws a thin line, a firm one a full-width
// stroke (0.55–1.45 × the chosen width), like the Pen in Apple's Markup.
export const PRESSURE_MIN_FACTOR = 0.55
export const PRESSURE_RANGE_FACTOR = 0.9

export function widthForPressure(base, pressure) {
  const p = Math.min(1, Math.max(0, pressure ?? 0.5))
  return base * (PRESSURE_MIN_FACTOR + PRESSURE_RANGE_FACTOR * p)
}

/**
 * Append a point (PDF user space) unless it is (almost) identical to the last one.
 * `minDist` in PDF units keeps stroke arrays compact. `pressure` (0..1, stylus only)
 * is stored alongside in `stroke.pressures`; strokes without it draw at constant width.
 */
export function appendPoint(stroke, px, py, pressure = null, minDist = 0.35) {
  const pts = stroke.points
  const n = pts.length
  if (n >= 2) {
    const dx = px - pts[n - 2]
    const dy = py - pts[n - 1]
    if (dx * dx + dy * dy < minDist * minDist) {
      // keep the firmest pressure of coalesced points that landed on the same spot
      if (pressure != null && stroke.pressures && stroke.pressures.length) {
        const i = stroke.pressures.length - 1
        stroke.pressures[i] = Math.max(stroke.pressures[i], pressure)
      }
      return false
    }
  }
  pts.push(px, py)
  if (pressure != null) {
    if (!stroke.pressures) stroke.pressures = new Array(n / 2).fill(pressure)
    stroke.pressures.push(pressure)
  } else if (stroke.pressures) {
    stroke.pressures.push(stroke.pressures[stroke.pressures.length - 1] ?? 0.5)
  }
  return true
}

/** Does this stroke carry usable per-point pressure (pen tool, at least one varying value)? */
export function hasPressure(stroke) {
  const p = stroke.pressures
  return stroke.tool !== 'highlighter' && Array.isArray(p) && p.length * 2 === stroke.points.length && p.length >= 1
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
  if (hasPressure(stroke)) return paintPressureStroke(ctx, viewport, stroke, dpr)
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

/**
 * Trace the outline of a variable-width stroke into `path` (anything with the canvas
 * methods moveTo / lineTo / quadraticCurveTo / arc, e.g. a 2d context or the PDF
 * adapter in pdfEdit.js): left edge forward, round cap, right edge back, round cap.
 * Filled once, so overlaps never darken and joins stay smooth. Coordinates are in
 * whatever space the caller provides (CSS px or PDF units) – the math is orientation-free.
 */
export function traceVariableWidth(xs, ys, ws, path) {
  const n = xs.length
  if (n === 0) return
  if (n === 1) {
    path.arc(xs[0], ys[0], ws[0] / 2, 0, Math.PI * 2, false)
    return
  }
  // Unit tangents (central differences), normals, and the two edges.
  const tx = new Float64Array(n)
  const ty = new Float64Array(n)
  let lx = 1
  let ly = 0
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1
    const b = i === n - 1 ? n - 1 : i + 1
    let dx = xs[b] - xs[a]
    let dy = ys[b] - ys[a]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) {
      dx = lx
      dy = ly
    } else {
      dx /= len
      dy /= len
      lx = dx
      ly = dy
    }
    tx[i] = dx
    ty[i] = dy
  }
  const leftX = (i) => xs[i] - ty[i] * (ws[i] / 2)
  const leftY = (i) => ys[i] + tx[i] * (ws[i] / 2)
  const rightX = (i) => xs[i] + ty[i] * (ws[i] / 2)
  const rightY = (i) => ys[i] - tx[i] * (ws[i] / 2)
  // Left edge, start → end (quadratic smoothing through midpoints).
  path.moveTo(leftX(0), leftY(0))
  let px = leftX(0)
  let py = leftY(0)
  for (let i = 1; i < n; i++) {
    const x = leftX(i)
    const y = leftY(i)
    path.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
    px = x
    py = y
  }
  path.lineTo(px, py)
  // Round cap at the end: from the left edge over the tip to the right edge.
  const e = n - 1
  path.arc(xs[e], ys[e], ws[e] / 2, Math.atan2(leftY(e) - ys[e], leftX(e) - xs[e]), Math.atan2(rightY(e) - ys[e], rightX(e) - xs[e]), true)
  // Right edge, end → start.
  px = rightX(e)
  py = rightY(e)
  for (let i = e - 1; i >= 0; i--) {
    const x = rightX(i)
    const y = rightY(i)
    path.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
    px = x
    py = y
  }
  path.lineTo(px, py)
  // Round cap at the start: from the right edge around the back to the left edge.
  path.arc(xs[0], ys[0], ws[0] / 2, Math.atan2(rightY(0) - ys[0], rightX(0) - xs[0]), Math.atan2(leftY(0) - ys[0], leftX(0) - xs[0]), true)
}

/** Per-point widths of a pressure stroke for a given base width (same units as `base`). */
export function pressureWidths(stroke, base) {
  const pr = stroke.pressures
  const ws = new Float64Array(pr.length)
  for (let i = 0; i < pr.length; i++) ws[i] = Math.max(base * 0.25, widthForPressure(base, pr[i]))
  return ws
}

function paintPressureStroke(ctx, viewport, stroke, dpr) {
  const pts = stroke.points
  const n = pts.length / 2
  const base = Math.max(0.5, (stroke.width || 1) * viewport.scale)
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const [x, y] = viewport.convertToViewportPoint(pts[i * 2], pts[i * 2 + 1])
    xs[i] = x
    ys[i] = y
  }
  setupCtx(ctx, dpr)
  ctx.save()
  ctx.fillStyle = stroke.color || '#000'
  ctx.globalAlpha = typeof stroke.opacity === 'number' ? stroke.opacity : 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.beginPath()
  traceVariableWidth(xs, ys, pressureWidths(stroke, base), ctx)
  ctx.closePath()
  ctx.fill()
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
