// Swedish screen-reader strings for @dnd-kit (defaults are English).
import { hasSortableData } from '@dnd-kit/sortable'

const pos = (e) => (hasSortableData(e) ? `${e.data.current.sortable.index + 1} av ${e.data.current.sortable.items.length}` : '')

export function makeDndA11y(noun = 'objektet') {
  return {
    announcements: {
      onDragStart: ({ active }) => `Lyfte upp ${noun} ${pos(active)}.`,
      onDragOver: ({ over }) => (over ? `${noun} flyttades till plats ${pos(over)}.` : `${noun} är inte över någon plats.`),
      onDragEnd: ({ over }) => (over ? `${noun} släpptes på plats ${pos(over)}.` : `${noun} släpptes.`),
      onDragCancel: () => `Flytten avbröts. ${noun} återgick till sin plats.`,
    },
    screenReaderInstructions: {
      draggable: `Tryck mellanslag för att lyfta ${noun}. Använd piltangenterna för att flytta. Tryck mellanslag igen för att släppa, eller Escape för att avbryta.`,
    },
  }
}

export const PAGE_DND_A11Y = makeDndA11y('sidan')
export const SETLIST_DND_A11Y = makeDndA11y('stycket')
