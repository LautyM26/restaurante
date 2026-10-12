import { describe, expect, it } from 'vitest'
import { lineKey } from '../../src/domain/cart'
import type { CartState } from '../../src/domain/types'
import { cartStorageKey, parseStoredCart, serializeCart } from '../../src/state/cartStorage'

const line = (dishId: string, quantity: number, selection = {}, note = '') => ({
  key: lineKey(dishId, selection, note),
  dishId,
  quantity,
  selection,
  note,
})

describe('cartStorageKey', () => {
  it('es una clave distinta por mesa', () => {
    expect(cartStorageKey(12)).toBe('restaurante.cart.table-12')
    expect(cartStorageKey(5)).toBe('restaurante.cart.table-5')
  })
})

describe('serializeCart / parseStoredCart', () => {
  const cart: CartState = {
    lines: [line('burger', 2, { cooking: ['rare'], extras: ['cheese', 'bacon'] }, 'sin sal'), line('salad', 1)],
    note: 'Es para un cumpleaños',
    pending: { clientRequestId: 'req-1', fingerprint: 'fp', startedAt: '2026-01-01T10:00:00.000Z' },
  }

  it('ida y vuelta conserva líneas, nota general e intento pendiente', () => {
    expect(parseStoredCart(serializeCart(cart)!)).toEqual(cart)
  })

  it('solo guarda ids y selección: ni nombres ni precios (RF44)', () => {
    const json = serializeCart(cart)!
    expect(Object.keys(JSON.parse(json).lines[0]).sort()).toEqual(['dishId', 'note', 'quantity', 'selection'])
  })

  it('sin datos o con JSON roto devuelve el pedido vacío', () => {
    expect(parseStoredCart(null)).toEqual({ lines: [], note: '' })
    expect(parseStoredCart('{no es json')).toEqual({ lines: [], note: '' })
    expect(parseStoredCart('[1,2]')).toEqual({ lines: [], note: '' })
    expect(parseStoredCart('"texto"')).toEqual({ lines: [], note: '' })
  })

  it('descarta las líneas mal formadas y conserva las buenas', () => {
    const raw = JSON.stringify({
      lines: [
        { dishId: 'ok', quantity: 3, selection: { g: ['a'] }, note: 'x' },
        { dishId: 'cantidad-cero', quantity: 0, selection: {}, note: '' },
        { dishId: 'cantidad-21', quantity: 21, selection: {}, note: '' },
        { dishId: 'cantidad-decimal', quantity: 1.5, selection: {}, note: '' },
        { dishId: 7, quantity: 1, selection: {}, note: '' },
        { dishId: 'seleccion-rota', quantity: 1, selection: { g: 'a' }, note: '' },
        { dishId: 'seleccion-con-numero', quantity: 1, selection: { g: [1] }, note: '' },
        { dishId: 'sin-nota', quantity: 1, selection: {} },
        null,
        'texto',
      ],
      note: 'general',
    })
    const parsed = parseStoredCart(raw)
    expect(parsed.lines.map((l) => l.dishId)).toEqual(['ok'])
    expect(parsed.note).toBe('general')
  })

  it('recalcula la clave de cada línea (no se fía de la guardada) y fusiona repetidas hasta 20', () => {
    const raw = JSON.stringify({
      lines: [
        { key: 'clave-falsa', dishId: 'a', quantity: 15, selection: {}, note: '' },
        { key: 'otra-falsa', dishId: 'a', quantity: 9, selection: {}, note: '' },
      ],
      note: '',
    })
    const { lines } = parseStoredCart(raw)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ key: lineKey('a', {}, ''), quantity: 20 })
  })

  it('recorta notas que superan el límite (nota del plato 140, general 200)', () => {
    const raw = JSON.stringify({
      lines: [{ dishId: 'a', quantity: 1, selection: {}, note: 'x'.repeat(300) }],
      note: 'y'.repeat(300),
    })
    const parsed = parseStoredCart(raw)
    expect(parsed.lines[0].note).toHaveLength(140)
    expect(parsed.note).toHaveLength(200)
  })

  it('ignora un intento pendiente incompleto', () => {
    const raw = JSON.stringify({ lines: [], note: '', pending: { clientRequestId: 'solo-id' } })
    expect(parseStoredCart(raw).pending).toBeUndefined()
  })

  it('un pedido vacío sin intento pendiente se serializa como nada para poder borrar la clave', () => {
    expect(serializeCart({ lines: [], note: '' })).toBeNull()
    expect(serializeCart({ lines: [], note: 'solo nota' })).not.toBeNull()
  })
})
