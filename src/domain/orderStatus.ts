// Ciclo de vida del pedido y reglas de cambio de estado (RF37, spec §3.1-§3.2, CL24, CL35).
import type { Order, OrderStatus } from './types'

/** Camino normal del pedido, en orden. */
export const ORDER_FLOW: readonly OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'delivered']
/** Estados finales: no admiten más transiciones. */
export const FINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled']

export function isFinal(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

/** Posición en el flujo normal (para la línea de tiempo); `cancelled` no está en el flujo y da -1. */
export function stepIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status)
}

/** Se puede pasar al siguiente estado del flujo, o a `cancelled` desde cualquier estado no final. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to || isFinal(from)) return false
  if (to === 'cancelled') return true
  return stepIndex(to) === stepIndex(from) + 1
}

export type TransitionResult =
  | { kind: 'applied'; order: Order }
  | { kind: 'noop' }
  | { kind: 'conflict'; current: Order }
  | { kind: 'invalid' }

/**
 * Aplica un cambio de estado pedido por el personal.
 * `noop`: el pedido ya está en `to` (se ignora, sin aviso). `conflict`: quien lo pide veía otro
 * estado (`expectedStatus`) y se devuelve el pedido actual. `invalid`: transición no permitida.
 */
export function applyTransition(
  order: Order,
  to: OrderStatus,
  expectedStatus: OrderStatus,
  nowIso: string,
): TransitionResult {
  if (order.status === to) return { kind: 'noop' }
  if (order.status !== expectedStatus) return { kind: 'conflict', current: order }
  if (!canTransition(order.status, to)) return { kind: 'invalid' }
  return {
    kind: 'applied',
    order: {
      ...order,
      status: to,
      updatedAt: nowIso,
      statusHistory: [...order.statusHistory, { status: to, at: nowIso }],
    },
  }
}
