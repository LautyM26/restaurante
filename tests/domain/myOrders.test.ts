import { selectRecentEntries, selectVisibleOrders } from '../../src/domain/myOrders'
import type { MyOrderEntry, OrderStatus } from '../../src/domain/types'
import { makeOrder } from '../fixtures/orders'

const NOW = '2026-10-11T20:00:00.000Z'
const HOUR = 3_600_000

const entry = (orderId: string, tableId: number, ageMs: number): MyOrderEntry => ({
  orderId,
  tableId,
  createdAt: new Date(Date.parse(NOW) - ageMs).toISOString(),
})

describe('selectRecentEntries', () => {
  it('conserva los pedidos de las últimas 12 horas, de todas las mesas', () => {
    const entries = [entry('a', 12, HOUR), entry('b', 5, 6 * HOUR), entry('c', 12, 11 * HOUR + 59 * 60_000)]
    expect(selectRecentEntries(entries, NOW, 12).map((e) => e.orderId)).toEqual(['a', 'b', 'c'])
  })

  it('descarta los que cumplen 12 horas o más', () => {
    const entries = [entry('old', 12, 12 * HOUR), entry('older', 5, 30 * HOUR), entry('new', 5, HOUR)]
    expect(selectRecentEntries(entries, NOW, 12).map((e) => e.orderId)).toEqual(['new'])
  })

  it('respeta la ventana recibida', () => {
    const entries = [entry('a', 1, 2 * HOUR)]
    expect(selectRecentEntries(entries, NOW, 1)).toEqual([])
    expect(selectRecentEntries(entries, NOW, 3)).toHaveLength(1)
  })

  it('descarta entradas con fecha inválida', () => {
    expect(selectRecentEntries([{ orderId: 'x', tableId: 1, createdAt: 'no-es-fecha' }], NOW, 12)).toEqual([])
  })

  it('una lista vacía da una lista vacía', () => {
    expect(selectRecentEntries([], NOW, 12)).toEqual([])
  })
})

describe('selectVisibleOrders', () => {
  const make = (id: string, status: OrderStatus) => makeOrder({ id, status })

  it('muestra los pedidos activos', () => {
    const orders = [make('a', 'pending'), make('b', 'accepted'), make('c', 'preparing'), make('d', 'ready')]
    expect(selectVisibleOrders(orders, new Set()).map((o) => o.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('oculta los finales que no están en keepIds', () => {
    const orders = [make('a', 'delivered'), make('b', 'cancelled'), make('c', 'ready')]
    expect(selectVisibleOrders(orders, new Set()).map((o) => o.id)).toEqual(['c'])
  })

  it('mantiene los finales que siguen en keepIds (CL39)', () => {
    const orders = [make('a', 'delivered'), make('b', 'cancelled'), make('c', 'ready')]
    expect(selectVisibleOrders(orders, new Set(['a'])).map((o) => o.id)).toEqual(['a', 'c'])
  })

  it('un id de keepIds que no existe en la lista no agrega nada', () => {
    expect(selectVisibleOrders([make('a', 'pending')], new Set(['zzz'])).map((o) => o.id)).toEqual(['a'])
  })
})
