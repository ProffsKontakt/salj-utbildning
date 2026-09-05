/** Tiny class name joiner. */
export function cn(...parts) {
  return parts.flat().filter(Boolean).join(' ')
}
