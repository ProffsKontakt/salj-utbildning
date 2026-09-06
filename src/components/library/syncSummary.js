// Pure description of the sync state for compact status UI (library pill,
// settings card). Kept free of JSX so both consumers can share it.
import { CloudCheck, CloudOff, CloudUpload, TriangleAlert } from 'lucide-react'
import { pluralize } from '../../lib/format.js'

/**
 * @param {{ phase:string, pending:number, error?:string|null }} status
 * @param {boolean} online
 * @returns {{ phase:'offline'|'syncing'|'error'|'pending'|'idle', label:string, tone:string, icon:React.ComponentType|null }}
 *   `icon` is null while syncing – render a spinner instead.
 */
export function summarizeSync(status, online) {
  if (!online || status.phase === 'offline') return { phase: 'offline', label: 'Offline', tone: 'text-ivory-300', icon: CloudOff }
  if (status.phase === 'syncing') return { phase: 'syncing', label: 'Synkar…', tone: 'text-gold-200', icon: null }
  if (status.phase === 'error') return { phase: 'error', label: 'Synkfel', tone: 'text-[#f08a86]', icon: TriangleAlert }
  if (status.pending > 0) return { phase: 'pending', label: pluralize(status.pending, 'ändring väntar', 'ändringar väntar'), tone: 'text-ivory-200', icon: CloudUpload }
  return { phase: 'idle', label: 'Synkat', tone: 'text-success', icon: CloudCheck }
}
