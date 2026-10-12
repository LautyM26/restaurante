// Registro local de pedidos enviados desde este dispositivo (RF28; plan §4): [{ orderId, tableId, createdAt }]
// en localStorage, compartido por las pestañas del navegador (= el mismo dispositivo). Solo guarda a qué
// pedidos seguirles el rastro; los datos viven en el restaurante. T9 lo lee desde MyOrdersProvider.
//   read()       → entradas de las últimas 12 horas, de todas las mesas (P3)
//   add(entry)   → agrega (sin repetir) y avisa a esta pestaña; las otras reciben el evento `storage`
//   subscribe(f) → f() cuando el registro cambia en esta pestaña o en otra
// El almacenamiento es seguro (RNF8): si el navegador lo bloquea, el registro vive en memoria.
import { MY_ORDERS_WINDOW_H } from '../config'
import { selectRecentEntries } from '../domain/myOrders'
import type { MyOrderEntry } from '../domain/types'
import { createLocalStorage } from '../services/storage'
import type { SafeStorage } from '../services/storage'

export const MY_ORDERS_KEY = 'restaurante.myOrders'

export interface MyOrdersStore {
  read(): MyOrderEntry[]
  add(entry: MyOrderEntry): void
  subscribe(listener: () => void): () => void
}

export interface MyOrdersStoreOptions {
  storage?: SafeStorage
  /** Dónde llega el evento `storage` de las otras pestañas; en los tests, un EventTarget propio. */
  target?: EventTarget
  now?: () => string
}

function isEntry(value: unknown): value is MyOrderEntry {
  if (typeof value !== 'object' || value === null) return false
  const { orderId, tableId, createdAt } = value as Record<string, unknown>
  return typeof orderId === 'string' && typeof tableId === 'number' && typeof createdAt === 'string'
}

/** Lo guardado no es de fiar: un registro dañado se lee como vacío y nunca rompe la app. */
function parseEntries(raw: string | null): MyOrderEntry[] {
  if (raw === null) return []
  try {
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isEntry) : []
  } catch {
    return []
  }
}

export function createMyOrdersStore({
  storage = createLocalStorage(),
  target = window,
  now = () => new Date().toISOString(),
}: MyOrdersStoreOptions = {}): MyOrdersStore {
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  // Otra pestaña escribió el registro (o borró todo el almacenamiento: key === null).
  const onStorage = (event: Event) => {
    const { key } = event as StorageEvent
    if (key === null || key === MY_ORDERS_KEY) notify()
  }

  const recent = () => selectRecentEntries(parseEntries(storage.get(MY_ORDERS_KEY)), now(), MY_ORDERS_WINDOW_H)

  return {
    read: recent,
    add(entry) {
      // Se descarta lo vencido al escribir: el registro no crece sin fin.
      const kept = recent()
      if (kept.some((existing) => existing.orderId === entry.orderId)) return // ya registrado: nada cambia
      storage.set(MY_ORDERS_KEY, JSON.stringify([...kept, entry]))
      notify()
    },
    subscribe(listener) {
      if (listeners.size === 0) target.addEventListener('storage', onStorage)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) target.removeEventListener('storage', onStorage)
      }
    },
  }
}

/** El registro de la aplicación: una sola instancia por pestaña. */
export const myOrdersStore: MyOrdersStore = createMyOrdersStore()
