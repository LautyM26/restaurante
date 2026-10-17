// Regla de demora compartida con el panel de la Spec 002 (RF48, spec §3.1).
import type { Order } from './types'

/** Minutos en `pending` a partir de los cuales un pedido se considera demorado. */
export const PENDING_DELAY_MINUTES = 10

/** Un pedido está demorado si lleva 10 minutos o más en `pending`. */
export function isDelayed(order: Order, nowMs: number): boolean {
  return order.status === 'pending' && nowMs - Date.parse(order.createdAt) >= PENDING_DELAY_MINUTES * 60_000
}
