import { PENDING_DELAY_MINUTES, isDelayed } from '../../src/domain/delay'
import type { OrderStatus } from '../../src/domain/types'
import { makeOrder } from '../fixtures/orders'

const MIN = 60_000
const created = Date.parse('2026-10-11T12:00:00.000Z')

describe('isDelayed', () => {
  it('el umbral compartido es de 10 minutos', () => {
    expect(PENDING_DELAY_MINUTES).toBe(10)
  })

  it('es falso a los 9:59 y verdadero a los 10:00 en pending', () => {
    const order = makeOrder({ status: 'pending' })
    expect(isDelayed(order, created + 9 * MIN + 59_000)).toBe(false)
    expect(isDelayed(order, created + 10 * MIN)).toBe(true)
    expect(isDelayed(order, created + 45 * MIN)).toBe(true)
  })

  it('es falso recién creado', () => {
    expect(isDelayed(makeOrder(), created)).toBe(false)
  })

  it.each<OrderStatus>(['accepted', 'preparing', 'ready', 'delivered', 'cancelled'])(
    'es falso en %s aunque pasen horas',
    (status) => {
      expect(isDelayed(makeOrder({ status }), created + 5 * 60 * MIN)).toBe(false)
    },
  )
})
