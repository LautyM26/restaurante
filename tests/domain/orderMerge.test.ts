import { mergeOrder, upsertOrders } from '../../src/domain/orderMerge'
import { makeOrder } from '../fixtures/orders'

const T0 = '2026-10-11T12:00:00.000Z'
const T1 = '2026-10-11T12:01:00.000Z'
const T2 = '2026-10-11T12:02:00.000Z'

describe('mergeOrder', () => {
  it('sin pedido actual toma el entrante', () => {
    const incoming = makeOrder()
    expect(mergeOrder(undefined, incoming)).toBe(incoming)
  })

  it('gana el entrante con updatedAt más nuevo', () => {
    const current = makeOrder({ status: 'accepted', updatedAt: T1 })
    const incoming = makeOrder({ status: 'preparing', updatedAt: T2 })
    expect(mergeOrder(current, incoming)).toBe(incoming)
  })

  it('un entrante más viejo no reemplaza (sin retrocesos)', () => {
    const current = makeOrder({ status: 'preparing', updatedAt: T2 })
    const incoming = makeOrder({ status: 'accepted', updatedAt: T1 })
    expect(mergeOrder(current, incoming)).toBe(current)
  })

  it('un entrante con el mismo updatedAt no reemplaza', () => {
    const current = makeOrder({ status: 'accepted', updatedAt: T1 })
    const incoming = makeOrder({ status: 'accepted', updatedAt: T1 })
    expect(mergeOrder(current, incoming)).toBe(current)
  })

  it('compara instantes y no texto: respeta formatos de fecha distintos', () => {
    const current = makeOrder({ updatedAt: '2026-10-11T12:00:00Z' })
    const incoming = makeOrder({ updatedAt: '2026-10-11T12:00:00.500Z' })
    expect(mergeOrder(current, incoming)).toBe(incoming)
  })
})

describe('upsertOrders', () => {
  it('agrega pedidos nuevos sin duplicar y ordena por creación descendente', () => {
    const a = makeOrder({ id: 'a', createdAt: T0 })
    const b = makeOrder({ id: 'b', createdAt: T2 })
    const c = makeOrder({ id: 'c', createdAt: T1 })
    expect(upsertOrders([a], [b, c]).map((o) => o.id)).toEqual(['b', 'c', 'a'])
  })

  it('un evento repetido (POST + order.created) no duplica el pedido', () => {
    const order = makeOrder({ id: 'a' })
    const list = upsertOrders([], [order])
    expect(upsertOrders(list, [order, order])).toHaveLength(1)
  })

  it('actualiza el pedido existente con el más nuevo y descarta el más viejo', () => {
    const list = [makeOrder({ id: 'a', status: 'preparing', updatedAt: T2 })]
    const older = makeOrder({ id: 'a', status: 'accepted', updatedAt: T1 })
    expect(upsertOrders(list, [older])[0].status).toBe('preparing')
    const newer = makeOrder({ id: 'a', status: 'ready', updatedAt: '2026-10-11T12:03:00.000Z' })
    expect(upsertOrders(list, [newer])[0].status).toBe('ready')
  })

  it('un lote con el mismo pedido en dos versiones queda con la más nueva sin importar el orden', () => {
    const v1 = makeOrder({ id: 'a', status: 'accepted', updatedAt: T1 })
    const v2 = makeOrder({ id: 'a', status: 'preparing', updatedAt: T2 })
    expect(upsertOrders([], [v2, v1])).toEqual([v2])
    expect(upsertOrders([], [v1, v2])).toEqual([v2])
  })

  it('no modifica la lista recibida', () => {
    const list = [makeOrder({ id: 'a' })]
    upsertOrders(list, [makeOrder({ id: 'b', createdAt: T2 })])
    expect(list.map((o) => o.id)).toEqual(['a'])
  })
})
