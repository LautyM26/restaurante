// Pedido en curso (RF19, RF20, RF23; plan §3, §4 y §5.3). Estado con el reducer puro `cartReducer` y
// persistido por mesa en sessionStorage: sobrevive a recargas mientras la pestaña siga abierta. El
// almacenamiento es seguro (RNF8): si el navegador lo bloquea, el pedido vive en memoria.
//
// `CartProvider` recibe la mesa; `TableCartProvider` la toma del TableProvider. Sin mesa (null) el pedido
// existe solo en memoria: no se guarda nada bajo una mesa que no se conoce.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import { addQuantity, cartReducer, lineKey } from '../domain/cart'
import type { CartState, PendingSubmission, Selection } from '../domain/types'
import { createSessionStorage } from '../services/storage'
import type { SafeStorage } from '../services/storage'
import { cartStorageKey, parseStoredCart, serializeCart } from './cartStorage'
import { useTable } from './TableContext'

export interface AddLineInput {
  dishId: string
  selection: Selection
  note: string
  quantity: number
}

export interface Cart extends CartState {
  /** Unidades totales (suma de las cantidades de todas las líneas). */
  units: number
  /** Último agregado (no se guarda): `seq` sube con cada `addLine` y `capped` dice si se recortó el tope. Lo usa la CartBar para confirmar. */
  lastAdd: { seq: number; capped: boolean }
  /** Suma la línea o la fusiona con una igual; `capped` avisa que se recortó a 20 ("Máximo 20 por plato"). */
  addLine: (input: AddLineInput) => { capped: boolean }
  setQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  setNote: (note: string) => void
  setPending: (pending: PendingSubmission) => void
  clearPending: () => void
  clear: () => void
}

const CartContext = createContext<Cart | null>(null)

/** Un provider por mesa: al cambiar `tableId` se remonta y arranca con el pedido guardado de esa mesa. */
export function CartProvider({ tableId, children }: { tableId: number | null; children: ReactNode }) {
  return (
    <CartStore key={tableId ?? 'none'} tableId={tableId}>
      {children}
    </CartStore>
  )
}

function CartStore({ tableId, children }: { tableId: number | null; children: ReactNode }) {
  const [storage] = useState<SafeStorage>(createSessionStorage)
  const [state, dispatch] = useReducer(cartReducer, undefined, (): CartState =>
    tableId === null ? parseStoredCart(null) : parseStoredCart(storage.get(cartStorageKey(tableId))),
  )

  const [lastAdd, setLastAdd] = useState({ seq: 0, capped: false })

  // Un pedido vacío borra la clave.
  const persist = useCallback(
    (cart: CartState) => {
      if (tableId === null) return
      const serialized = serializeCart(cart)
      if (serialized === null) storage.remove(cartStorageKey(tableId))
      else storage.set(cartStorageKey(tableId), serialized)
    },
    [tableId, storage],
  )

  // Cada cambio se guarda.
  useEffect(() => persist(state), [state, persist])

  const addLine = useCallback(
    ({ dishId, selection, note, quantity }: AddLineInput) => {
      // El tope se calcula antes de despachar: el reducer recorta pero no informa.
      const key = lineKey(dishId, selection, note)
      const existing = state.lines.find((line) => line.key === key)
      const { capped } = addQuantity(existing?.quantity ?? 0, quantity)
      dispatch({ type: 'add', dishId, selection, note, quantity })
      setLastAdd((previous) => ({ seq: previous.seq + 1, capped }))
      return { capped }
    },
    [state.lines],
  )

  const value = useMemo<Cart>(
    () => ({
      ...state,
      units: state.lines.reduce((total, line) => total + line.quantity, 0),
      lastAdd,
      addLine,
      setQuantity: (key, quantity) => dispatch({ type: 'setQuantity', key, quantity }),
      removeLine: (key) => dispatch({ type: 'remove', key }),
      setNote: (note) => dispatch({ type: 'setNote', note }),
      // El intento se guarda YA, sin esperar al render: si la página se cierra a mitad del envío, al volver
      // todavía se sabe qué id se usó (RF26). El efecto de arriba escribirá lo mismo.
      setPending: (pending) => {
        persist({ ...state, pending })
        dispatch({ type: 'setPending', pending })
      },
      clearPending: () => dispatch({ type: 'clearPending' }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state, lastAdd, addLine, persist],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/** La mesa viene del TableProvider: hay pedido para la mesa pedida mientras se verifica o si no se pudo verificar. */
export function TableCartProvider({ children }: { children: ReactNode }) {
  const table = useTable()
  return <CartProvider tableId={'tableId' in table ? (table.tableId ?? null) : null}>{children}</CartProvider>
}

export function useCart(): Cart {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return cart
}
