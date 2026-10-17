// OrderService falso escrito a mano, SIN transporte (RNF10): sirve para probar pantallas y estado sin
// mock ni canales. Cada método es un `vi.fn` que las pruebas pueden reconfigurar (`mockResolvedValueOnce`,
// `mockRejectedValueOnce`) y `emit` simula un aviso en tiempo real.
import { vi } from 'vitest'
import { ServiceError } from '../../src/services/contracts'
import type { OrderService, SubscriptionFilter } from '../../src/services/contracts'
import type { Order, OrderEvent } from '../../src/domain/types'

export interface FakeSubscription {
  filter: SubscriptionFilter
  active: boolean
}

type Mocked<T extends (...args: never[]) => unknown> = ReturnType<typeof vi.fn<T>>

export interface FakeOrderService extends OrderService {
  createOrder: Mocked<OrderService['createOrder']>
  findByClientRequestId: Mocked<OrderService['findByClientRequestId']>
  getOrders: Mocked<OrderService['getOrders']>
  listOrders: Mocked<OrderService['listOrders']>
  updateOrderStatus: Mocked<OrderService['updateOrderStatus']>
  subscribe: Mocked<OrderService['subscribe']>
  /** Pedidos que devuelven getOrders / listOrders / findByClientRequestId. */
  orders: Order[]
  /** Una entrada por cada llamada a subscribe, en orden. */
  subscriptions: FakeSubscription[]
  /** Entrega el evento a las suscripciones activas cuyo filtro coincide. */
  emit(event: OrderEvent): void
}

const notConfigured = (method: string) =>
  new ServiceError('SERVER', `fakeOrderService.${method} no está configurado en esta prueba`)

export function createFakeOrderService({ orders = [] }: { orders?: Order[] } = {}): FakeOrderService {
  const listeners: { listener: (event: OrderEvent) => void; subscription: FakeSubscription }[] = []

  const fake: FakeOrderService = {
    orders,
    subscriptions: [],
    createOrder: vi.fn<OrderService['createOrder']>(async () => {
      throw notConfigured('createOrder')
    }),
    updateOrderStatus: vi.fn<OrderService['updateOrderStatus']>(async () => {
      throw notConfigured('updateOrderStatus')
    }),
    findByClientRequestId: vi.fn<OrderService['findByClientRequestId']>(
      async (clientRequestId) => fake.orders.find((o) => o.clientRequestId === clientRequestId) ?? null,
    ),
    getOrders: vi.fn<OrderService['getOrders']>(async (ids) => fake.orders.filter((o) => ids.includes(o.id))),
    listOrders: vi.fn<OrderService['listOrders']>(async ({ tableIds }) =>
      fake.orders.filter((o) => !tableIds || tableIds.includes(o.tableId)),
    ),
    subscribe: vi.fn<OrderService['subscribe']>((listener, filter) => {
      const subscription: FakeSubscription = { filter, active: true }
      fake.subscriptions.push(subscription)
      listeners.push({ listener, subscription })
      return () => {
        subscription.active = false
      }
    }),
    emit(event) {
      for (const { listener, subscription } of listeners) {
        const { filter } = subscription
        if (!subscription.active) continue
        if (filter.kind === 'tables' && !filter.tableIds.includes(event.order.tableId)) continue
        listener(event)
      }
    },
  }
  return fake
}
