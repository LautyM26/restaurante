// Selección de los pedidos que "Mis pedidos" muestra (RF28, P3, CL39).
import { isFinal } from './orderStatus'
import type { MyOrderEntry, Order } from './types'

const HOUR_MS = 3_600_000

/** Entradas del registro local creadas hace menos de `windowHours` horas, de todas las mesas. */
export function selectRecentEntries(entries: MyOrderEntry[], nowIso: string, windowHours: number): MyOrderEntry[] {
  const limit = Date.parse(nowIso) - windowHours * HOUR_MS
  return entries.filter((entry) => Date.parse(entry.createdAt) > limit)
}

/** Pedidos activos más los que llegaron a un estado final pero siguen en `keepIds` (la pantalla está abierta). */
export function selectVisibleOrders(orders: Order[], keepIds: ReadonlySet<string>): Order[] {
  return orders.filter((order) => !isFinal(order.status) || keepIds.has(order.id))
}
