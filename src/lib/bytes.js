/** Return a standalone ArrayBuffer for a Uint8Array/ArrayBuffer/Blob-derived view. */
export function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
  }
  throw new TypeError('toArrayBuffer: unsupported input')
}

export async function blobToArrayBuffer(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

export function bytesToBlob(bytes, mime) {
  return new Blob([bytes], { type: mime })
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/** Extract a filename without extension. */
export function baseName(name = '') {
  const s = String(name).split(/[\\/]/).pop() || ''
  return s.replace(/\.[^.]+$/, '')
}
