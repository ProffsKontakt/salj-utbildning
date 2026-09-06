// Copies the pdf.js runtime assets (standard fonts, CMaps, WASM decoders) into
// public/pdfjs so the worker can fetch them at runtime. Runs before dev/build.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'node_modules', 'pdfjs-dist')
const dest = join(root, 'public', 'pdfjs')

if (!existsSync(src)) {
  console.error('pdfjs-dist is not installed – run npm install first')
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
for (const dir of ['standard_fonts', 'cmaps', 'wasm']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true })
}
console.log('pdf.js assets copied to public/pdfjs')
