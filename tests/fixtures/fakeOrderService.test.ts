import { describe, expect, it } from 'vitest'
import { ServiceError } from '../../src/services/contracts'
import { createFakeOrderService } from './fakeOrderService'
import { makeOrder } from './orders'

describe('fakeOrderService (OrderService escrito a mano, sin transporte)', () => {
  it('getOrders y findByClientRequestId consultan los pedidos cargados', async () => {
    const a = makeOrder({ id: 'a', clientRequestId: 'req-a' })
    const b = makeOrder({ id: 'b', clientRequestId: 'req-b', tableId: 5 })
    const fake = createFakeOrderService({ orders: [a, b] })

    expect(await fake.getOrders(['b', 'nada'])).toEqual([b])
    expect(await fake.findByClientRequestId('req-a')).toEqual(a)
    expect(await fake.findByClientRequestId('otro')).toBeNull()
    expect(await fake.listOrders({ tableIds: [5] })).toEqual([b])
  })

  it('emit entrega solo a las suscripciones activas cuyo filtro coincide', () => {
    const fake = createFakeOrderService()
    const forTable12: string[] = []
    const forStaff: string[] = []
    const stop = fake.subscribe((e) => forTable12.push(e.order.id), { kind: 'tables', tableIds: [12] })
    fake.subscribe((e) => forStaff.push(e.order.id), { kind: 'staff' })

    fake.emit({ type: 'order.created', order: makeOrder({ id: 'x', tableId: 12 }) })
    fake.emit({ type: 'order.created', order: makeOrder({ id: 'y', tableId: 5 }) })
    stop()
    fake.emit({ type: 'order.created', order: makeOrder({ id: 'z', tableId: 12 }) })

    expect(forTable12).toEqual(['x'])
    expect(forStaff).toEqual(['x', 'y', 'z'])
    expect(fake.subscriptions.map((s) => s.active)).toEqual([false, true])
  })

  it('los métodos sin configurar fallan en voz alta y se pueden reemplazar por prueba', async () => {
    const fake = createFakeOrderService()
    const error = await fake.createOrder({ clientRequestId: 'r', tableId: 1, items: [], expectedTotalCents: 0 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ServiceError)

    const order = makeOrder()
    fake.createOrder.mockResolvedValueOnce(order)
    expect(await fake.createOrder({ clientRequestId: 'r', tableId: 1, items: [], expectedTotalCents: 0 })).toBe(order)
    expect(fake.createOrder).toHaveBeenCalledTimes(2)
  })
})
