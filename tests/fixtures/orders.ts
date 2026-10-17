// Constructor de pedidos para los tests del dominio.
import type { Order } from '../../src/domain/types'

/** Pedido `pending` de la mesa 12, creado a las 12:00 UTC; cualquier campo se puede reemplazar. */
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    code: 'K7F2',
    clientRequestId: 'req-1',
    tableId: 12,
    items: [],
    totalCents: 0,
    status: 'pending',
    createdAt: '2026-10-11T12:00:00.000Z',
    updatedAt: '2026-10-11T12:00:00.000Z',
    statusHistory: [{ status: 'pending', at: '2026-10-11T12:00:00.000Z' }],
    ...overrides,
  }
}
