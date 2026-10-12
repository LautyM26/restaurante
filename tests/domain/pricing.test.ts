import { cartTotalCents, lineTotalCents, unitPriceCents } from '../../src/domain/pricing'
import type { CartLine } from '../../src/domain/types'
import { burger, menu, salad } from '../fixtures/menu'

function line(dishId: string, selection: CartLine['selection'], quantity: number): CartLine {
  return { key: `${dishId}-${quantity}`, dishId, selection, quantity, note: '' }
}

describe('unitPriceCents', () => {
  it('sin opciones es el precio base', () => {
    expect(unitPriceCents(salad, {})).toBe(500000)
  })

  it('suma el precio base y los adicionales elegidos', () => {
    expect(unitPriceCents(burger, { cooking: ['rare'], extras: ['cheese', 'bacon'] })).toBe(1200000 + 50000 + 80000)
  })

  it('una opción con adicional 0 no cambia el precio', () => {
    expect(unitPriceCents(burger, { cooking: ['medium'], extras: ['ketchup'] })).toBe(1200000)
  })

  it('ignora opciones que no existen en el plato', () => {
    expect(unitPriceCents(burger, { cooking: ['nope'], ghost: ['cheese'] })).toBe(1200000)
  })
})

describe('lineTotalCents', () => {
  it('es (base + adicionales) × cantidad', () => {
    expect(lineTotalCents(burger, { extras: ['cheese'] }, 3)).toBe((1200000 + 50000) * 3)
    expect(lineTotalCents(salad, {}, 1)).toBe(500000)
  })

  it('con adicional 0 es solo base × cantidad', () => {
    expect(lineTotalCents(burger, { extras: ['ketchup'] }, 2)).toBe(2400000)
  })
})

describe('cartTotalCents', () => {
  it('suma el total de todas las líneas con los precios de la carta vigente', () => {
    const lines = [line('burger', { extras: ['cheese'] }, 2), line('salad', {}, 3)]
    expect(cartTotalCents(lines, menu)).toBe((1200000 + 50000) * 2 + 500000 * 3)
  })

  it('un carrito vacío vale 0', () => {
    expect(cartTotalCents([], menu)).toBe(0)
  })

  it('una línea de un plato que ya no está en la carta no suma (se bloquea el envío por RF44)', () => {
    expect(cartTotalCents([line('salad', {}, 1), line('ghost', {}, 5)], menu)).toBe(500000)
  })
})
