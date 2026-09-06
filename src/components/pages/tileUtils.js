// Shared constants/helpers for page tiles (kept out of the component files so
// fast refresh keeps working).

export const TILE_PADDING = 8
export const THUMB_ASPECT = 4 / 3 // height / width of the thumbnail box

/** dnd-kit ids are strings so a source index of 0 never reads as "falsy". */
export function tileId(srcIndex) {
  return `page-${srcIndex}`
}

export function tileSrcIndex(id) {
  const n = Number(String(id).replace(/^page-/, ''))
  return Number.isInteger(n) ? n : null
}

export function tileLabel(srcIndex, position, total, rotation) {
  return `Sida ${srcIndex + 1} i filen, plats ${position + 1} av ${total}${rotation ? `, roterad ${rotation} grader` : ''}`
}
