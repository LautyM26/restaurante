// Reglas de consistencia al combinar versiones de un pedido (RF30, RNF10): sin retrocesos ni duplicados.
import type { Order } from './types'

/** Gana el pedido con `updatedAt` más nuevo; con igual o más viejo se queda el actual. */
export function mergeOrder(current: Order | undefined, incoming: Order): Order {
  if (!current) return incoming
  return Date.parse(incoming.updatedAt) > Date.parse(current.updatedAt) ? incoming : current
}

/** Incorpora pedidos a la lista (uno por id, aplicando mergeOrder), del más nuevo al más viejo por creación. */
export function upsertOrders(list: Order[], incoming: Order[]): Order[] {
  const byId = new Map(list.map((order) => [order.id, order]))
  for (const order of incoming) byId.set(order.id, mergeOrder(byId.get(order.id), order))
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
