import {
  FINAL_STATUSES,
  ORDER_FLOW,
  applyTransition,
  canTransition,
  isFinal,
  stepIndex,
} from '../../src/domain/orderStatus'
import type { OrderStatus } from '../../src/domain/types'
import { makeOrder } from '../fixtures/orders'

const LATER = '2026-10-11T12:05:00.000Z'

describe('constantes del ciclo de vida', () => {
  it('el flujo normal y los estados finales coinciden con la spec §3.1', () => {
    expect(ORDER_FLOW).toEqual(['pending', 'accepted', 'preparing', 'ready', 'delivered'])
    expect(FINAL_STATUSES).toEqual(['delivered', 'cancelled'])
  })

  it('isFinal distingue los estados finales de los activos', () => {
    expect(isFinal('delivered')).toBe(true)
    expect(isFinal('cancelled')).toBe(true)
    for (const status of ['pending', 'accepted', 'preparing', 'ready'] as const) expect(isFinal(status)).toBe(false)
  })

  it('stepIndex da la posición en el flujo y -1 para cancelado', () => {
    expect(ORDER_FLOW.map(stepIndex)).toEqual([0, 1, 2, 3, 4])
    expect(stepIndex('cancelled')).toBe(-1)
  })
})

describe('canTransition', () => {
  it.each([
    ['pending', 'accepted'],
    ['accepted', 'preparing'],
    ['preparing', 'ready'],
    ['ready', 'delivered'],
  ] as const)('permite avanzar %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each(['pending', 'accepted', 'preparing', 'ready'] as const)('permite cancelar desde %s', (from) => {
    expect(canTransition(from, 'cancelled')).toBe(true)
  })

  it.each([
    ['pending', 'preparing'],
    ['pending', 'ready'],
    ['pending', 'delivered'],
    ['accepted', 'ready'],
    ['accepted', 'pending'],
    ['preparing', 'accepted'],
    ['ready', 'preparing'],
    ['delivered', 'preparing'],
    ['delivered', 'cancelled'],
    ['cancelled', 'pending'],
    ['cancelled', 'accepted'],
  ] as const)('rechaza %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it.each<OrderStatus>(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'])(
    'rechaza quedarse en %s (mismo estado)',
    (status) => {
      expect(canTransition(status, status)).toBe(false)
    },
  )
})

describe('applyTransition', () => {
  it('aplica una transición válida: nuevo estado, updatedAt e historial', () => {
    const order = makeOrder()
    const result = applyTransition(order, 'accepted', 'pending', LATER)
    expect(result.kind).toBe('applied')
    if (result.kind !== 'applied') return
    expect(result.order.status).toBe('accepted')
    expect(result.order.updatedAt).toBe(LATER)
    expect(result.order.createdAt).toBe(order.createdAt)
    expect(result.order.statusHistory).toEqual([
      { status: 'pending', at: '2026-10-11T12:00:00.000Z' },
      { status: 'accepted', at: LATER },
    ])
  })

  it('no modifica el pedido recibido', () => {
    const order = makeOrder()
    applyTransition(order, 'accepted', 'pending', LATER)
    expect(order.status).toBe('pending')
    expect(order.statusHistory).toHaveLength(1)
  })

  it('aplica una cancelación desde un estado activo', () => {
    const order = makeOrder({ status: 'preparing' })
    const result = applyTransition(order, 'cancelled', 'preparing', LATER)
    expect(result).toMatchObject({ kind: 'applied', order: { status: 'cancelled' } })
  })

  it('pedir el estado que el pedido ya tiene es noop', () => {
    expect(applyTransition(makeOrder({ status: 'accepted' }), 'accepted', 'accepted', LATER)).toEqual({ kind: 'noop' })
  })

  it('el noop tiene prioridad sobre el conflicto (spec §3.2)', () => {
    expect(applyTransition(makeOrder({ status: 'accepted' }), 'accepted', 'pending', LATER)).toEqual({ kind: 'noop' })
  })

  it('si el estado esperado es distinto del actual hay conflicto y devuelve el pedido actual', () => {
    const order = makeOrder({ status: 'accepted' })
    const result = applyTransition(order, 'preparing', 'pending', LATER)
    expect(result).toEqual({ kind: 'conflict', current: order })
  })

  it('una transición no permitida con el estado esperado correcto es invalid', () => {
    expect(applyTransition(makeOrder({ status: 'delivered' }), 'preparing', 'delivered', LATER)).toEqual({ kind: 'invalid' })
    expect(applyTransition(makeOrder(), 'ready', 'pending', LATER)).toEqual({ kind: 'invalid' })
  })

  it('un estado final no admite cancelar', () => {
    expect(applyTransition(makeOrder({ status: 'delivered' }), 'cancelled', 'delivered', LATER)).toEqual({ kind: 'invalid' })
  })
})
