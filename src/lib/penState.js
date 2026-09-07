// Shared, module-level input state used for palm rejection and for keeping
// background work (page rasterisation) out of the way while someone is drawing.

let activePointers = 0
let penActive = 0
let penUpAt = -Infinity

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** A drawing gesture started (any pointer type). */
export function noteGestureStart(pointerType) {
  activePointers++
  if (pointerType === 'pen') penActive++
}

/** A drawing gesture ended. */
export function noteGestureEnd(pointerType) {
  activePointers = Math.max(0, activePointers - 1)
  if (pointerType === 'pen') {
    penActive = Math.max(0, penActive - 1)
    if (!penActive) penUpAt = nowMs()
  }
}

/** True while any drawing gesture is in progress. */
export function isDrawing() {
  return activePointers > 0
}

/** True while a stylus is on the glass. */
export function isPenDown() {
  return penActive > 0
}

/**
 * Touches are ignored while a stylus is down and for a short grace period after it
 * lifts: the resting hand usually stays on the glass a little longer than the pen.
 */
export function touchBlocked(graceMs = 700) {
  return penActive > 0 || nowMs() - penUpAt < graceMs
}

// ── "A stylus was used" – lets the tool settings switch to pen-only automatically ──

const penSeenListeners = new Set()

export function onPenSeen(listener) {
  penSeenListeners.add(listener)
  return () => penSeenListeners.delete(listener)
}

export function notePenSeen() {
  for (const l of penSeenListeners) l()
}
