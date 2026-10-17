// Pedido en curso: claves de línea, cantidades, reducer puro e huella del envío (RF19, RF20, RF22, RF26).
import { MAX_QTY, NOTE_MAX, ORDER_NOTE_MAX } from '../config'
import { canonicalSelection } from './selection'
import { limitVisibleChars } from './text'
import type { CartLine, CartState, CreateOrderInput, PendingSubmission, Selection } from './types'

export const EMPTY_CART: CartState = { lines: [], note: '' }

/** Clave de una línea: plato + opciones (sin importar el orden) + nota. Dos líneas con la misma clave se fusionan. */
export function lineKey(dishId: string, selection: Selection, note: string): string {
  return JSON.stringify([dishId, canonicalSelection(selection), note])
}

/** Suma cantidades con tope en 20; `capped` indica que se recortó (aviso "Máximo 20 por plato"). */
export function addQuantity(current: number, added: number): { quantity: number; capped: boolean } {
  return { quantity: Math.min(MAX_QTY, current + added), capped: current + added > MAX_QTY }
}

export type CartAction =
  | { type: 'add'; dishId: string; selection: Selection; note: string; quantity: number }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'setNote'; note: string }
  | { type: 'setPending'; pending: PendingSubmission }
  | { type: 'clearPending' }
  | { type: 'clear' }

const isValidQuantity = (quantity: number) => Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QTY

/** Reducer puro del pedido en curso. Una acción inválida devuelve el mismo estado. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (!Number.isInteger(action.quantity) || action.quantity < 1) return state
      const note = limitVisibleChars(action.note, NOTE_MAX)
      const key = lineKey(action.dishId, action.selection, note)
      if (state.lines.some((l) => l.key === key)) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, quantity: addQuantity(l.quantity, action.quantity).quantity } : l,
          ),
        }
      }
      const line: CartLine = {
        key,
        dishId: action.dishId,
        selection: action.selection,
        quantity: addQuantity(0, action.quantity).quantity,
        note,
      }
      return { ...state, lines: [...state.lines, line] }
    }
    case 'setQuantity': {
      if (!isValidQuantity(action.quantity) || !state.lines.some((l) => l.key === action.key)) return state
      return {
        ...state,
        lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: action.quantity } : l)),
      }
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) }
    case 'setNote':
      return { ...state, note: limitVisibleChars(action.note, ORDER_NOTE_MAX) }
    case 'setPending':
      return { ...state, pending: action.pending }
    case 'clearPending':
      return { lines: state.lines, note: state.note }
    case 'clear':
      return EMPTY_CART
  }
}

/**
 * Huella del contenido de un envío (sin `clientRequestId`): igual para el mismo contenido
 * sin importar el orden de líneas u opciones, distinta si cambia cualquier dato.
 * Decide si un intento pendiente se puede reintentar con el mismo id (RF26).
 */
export function submissionFingerprint(input: Omit<CreateOrderInput, 'clientRequestId'>): string {
  const items = [...input.items]
    .sort((a, b) => (a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0))
    .map((item) => ({
      lineId: item.lineId,
      dishId: item.dishId,
      quantity: item.quantity,
      selection: canonicalSelection(item.selection),
      note: item.note ?? '',
    }))
  return JSON.stringify({
    tableId: input.tableId,
    note: input.note ?? '',
    expectedTotalCents: input.expectedTotalCents,
    items,
  })
}
