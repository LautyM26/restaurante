// Guardado del pedido en curso en sessionStorage (RF23, RNF8; plan §4). Funciones puras: leen y escriben
// texto, no tocan el almacenamiento. Solo se guardan ids y selección; nombres y precios se derivan de la
// carta vigente (RF44). Lo guardado no es de fiar: se valida todo y se recalculan las claves.
import { MAX_QTY, NOTE_MAX, ORDER_NOTE_MAX } from '../config'
import { EMPTY_CART, cartReducer } from '../domain/cart'
import { limitVisibleChars } from '../domain/text'
import type { CartState, PendingSubmission, Selection } from '../domain/types'

/** Una clave por mesa: los pedidos en curso de mesas distintas no se mezclan (CL2). */
export const cartStorageKey = (tableId: number) => `restaurante.cart.table-${tableId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSelection = (value: unknown): value is Selection =>
  isRecord(value) && Object.values(value).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'))

function parsePending(value: unknown): PendingSubmission | undefined {
  if (!isRecord(value)) return undefined
  const { clientRequestId, fingerprint, startedAt } = value
  if (typeof clientRequestId !== 'string' || typeof fingerprint !== 'string' || typeof startedAt !== 'string') {
    return undefined
  }
  return { clientRequestId, fingerprint, startedAt }
}

/** Pedido guardado → estado. Cualquier dato inválido se descarta: un guardado dañado nunca rompe la app. */
export function parseStoredCart(raw: string | null): CartState {
  if (raw === null) return EMPTY_CART
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return EMPTY_CART
  }
  if (!isRecord(data)) return EMPTY_CART

  // Las líneas pasan por el reducer: recalcula la clave, fusiona repetidas (con tope) y recorta notas.
  let cart: CartState = EMPTY_CART
  const lines = Array.isArray(data.lines) ? data.lines : []
  for (const line of lines) {
    if (!isRecord(line)) continue
    const { dishId, quantity, selection, note } = line
    if (typeof dishId !== 'string' || typeof note !== 'string' || !isSelection(selection)) continue
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) continue
    cart = cartReducer(cart, {
      type: 'add',
      dishId,
      selection,
      note: limitVisibleChars(note, NOTE_MAX),
      quantity,
    })
  }

  const note = typeof data.note === 'string' ? limitVisibleChars(data.note, ORDER_NOTE_MAX) : ''
  const pending = parsePending(data.pending)
  return { lines: cart.lines, note, ...(pending && { pending }) }
}

/** Estado → texto a guardar, o `null` si no hay nada que recordar (así se borra la clave). */
export function serializeCart(cart: CartState): string | null {
  if (cart.lines.length === 0 && cart.note === '' && !cart.pending) return null
  return JSON.stringify({
    lines: cart.lines.map(({ dishId, quantity, selection, note }) => ({ dishId, quantity, selection, note })),
    note: cart.note,
    ...(cart.pending && { pending: cart.pending }),
  })
}
