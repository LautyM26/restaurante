import {
  EMPTY_CART,
  addQuantity,
  cartReducer,
  lineKey,
  submissionFingerprint,
} from '../../src/domain/cart'
import type { CartState, CreateOrderInput } from '../../src/domain/types'

const NOW = '2026-10-11T12:00:00.000Z'

describe('lineKey', () => {
  it('es igual para la misma configuración sin importar el orden de las opciones', () => {
    const a = lineKey('burger', { extras: ['cheese', 'bacon'], cooking: ['rare'] }, '')
    const b = lineKey('burger', { cooking: ['rare'], extras: ['bacon', 'cheese'] }, '')
    expect(a).toBe(b)
  })

  it('cambia con el plato, las opciones o la nota', () => {
    const base = lineKey('burger', { cooking: ['rare'] }, '')
    expect(lineKey('salad', { cooking: ['rare'] }, '')).not.toBe(base)
    expect(lineKey('burger', { cooking: ['medium'] }, '')).not.toBe(base)
    expect(lineKey('burger', { cooking: ['rare'] }, 'sin sal')).not.toBe(base)
  })

  it('un grupo vacío equivale a un grupo ausente', () => {
    expect(lineKey('burger', { extras: [] }, '')).toBe(lineKey('burger', {}, ''))
  })

  it('no confunde un plato con la nota de otro (sin colisiones por concatenación)', () => {
    expect(lineKey('a', {}, 'b')).not.toBe(lineKey('ab', {}, ''))
  })
})

describe('addQuantity', () => {
  it('suma sin tope', () => {
    expect(addQuantity(3, 4)).toEqual({ quantity: 7, capped: false })
  })

  it('llegar justo a 20 no es tope', () => {
    expect(addQuantity(15, 5)).toEqual({ quantity: 20, capped: false })
  })

  it('superar 20 deja 20 y avisa (P6)', () => {
    expect(addQuantity(15, 6)).toEqual({ quantity: 20, capped: true })
    expect(addQuantity(20, 1)).toEqual({ quantity: 20, capped: true })
    expect(addQuantity(0, 25)).toEqual({ quantity: 20, capped: true })
  })
})

describe('cartReducer', () => {
  const add = (state: CartState, over: Partial<{ dishId: string; selection: Record<string, string[]>; note: string; quantity: number }> = {}) =>
    cartReducer(state, { type: 'add', dishId: 'burger', selection: { cooking: ['rare'] }, note: '', quantity: 1, ...over })

  it('arranca vacío', () => {
    expect(EMPTY_CART).toEqual({ lines: [], note: '' })
  })

  it('agrega una línea nueva con su clave', () => {
    const state = add(EMPTY_CART, { quantity: 2, note: 'sin sal' })
    expect(state.lines).toEqual([
      {
        key: lineKey('burger', { cooking: ['rare'] }, 'sin sal'),
        dishId: 'burger',
        selection: { cooking: ['rare'] },
        quantity: 2,
        note: 'sin sal',
      },
    ])
  })

  it('fusiona la misma configuración aunque las opciones vengan en otro orden', () => {
    const first = add(EMPTY_CART, { selection: { extras: ['cheese', 'bacon'] }, quantity: 1 })
    const second = add(first, { selection: { extras: ['bacon', 'cheese'] }, quantity: 2 })
    expect(second.lines).toHaveLength(1)
    expect(second.lines[0].quantity).toBe(3)
  })

  it('no fusiona si cambian las opciones o la nota', () => {
    const state = add(add(add(EMPTY_CART), { note: 'sin sal' }), { selection: { cooking: ['medium'] } })
    expect(state.lines).toHaveLength(3)
  })

  it('al fusionar no supera 20: queda en 20 (P6)', () => {
    const state = add(add(EMPTY_CART, { quantity: 15 }), { quantity: 10 })
    expect(state.lines).toHaveLength(1)
    expect(state.lines[0].quantity).toBe(20)
  })

  it('limita la nota del plato a 140 caracteres visibles', () => {
    const state = add(EMPTY_CART, { note: 'a'.repeat(200) })
    expect(state.lines[0].note).toBe('a'.repeat(140))
  })

  it('ignora una cantidad fuera de rango al agregar', () => {
    expect(add(EMPTY_CART, { quantity: 0 })).toBe(EMPTY_CART)
    expect(add(EMPTY_CART, { quantity: -2 })).toBe(EMPTY_CART)
    expect(add(EMPTY_CART, { quantity: 1.5 })).toBe(EMPTY_CART)
  })

  describe('setQuantity', () => {
    const state = add(EMPTY_CART, { quantity: 2 })
    const key = state.lines[0].key

    it('cambia la cantidad dentro de 1 a 20', () => {
      expect(cartReducer(state, { type: 'setQuantity', key, quantity: 1 }).lines[0].quantity).toBe(1)
      expect(cartReducer(state, { type: 'setQuantity', key, quantity: 20 }).lines[0].quantity).toBe(20)
    })

    it.each([0, -1, 21, 1.5, Number.NaN])('rechaza %s y deja el estado intacto', (quantity) => {
      expect(cartReducer(state, { type: 'setQuantity', key, quantity })).toBe(state)
    })

    it('ignora una clave desconocida', () => {
      expect(cartReducer(state, { type: 'setQuantity', key: 'nope', quantity: 3 })).toBe(state)
    })
  })

  it('remove quita solo la línea indicada', () => {
    const state = add(add(EMPTY_CART), { selection: { cooking: ['medium'] } })
    const [first, second] = state.lines
    expect(cartReducer(state, { type: 'remove', key: first.key }).lines).toEqual([second])
    expect(cartReducer(state, { type: 'remove', key: 'nope' }).lines).toHaveLength(2)
  })

  it('setNote limita la nota general a 200 caracteres visibles', () => {
    expect(cartReducer(EMPTY_CART, { type: 'setNote', note: 'mesa junto a la ventana' }).note).toBe(
      'mesa junto a la ventana',
    )
    expect(cartReducer(EMPTY_CART, { type: 'setNote', note: 'b'.repeat(300) }).note).toBe('b'.repeat(200))
  })

  it('setPending y clearPending guardan y borran el intento pendiente', () => {
    const pending = { clientRequestId: 'req-1', fingerprint: 'fp', startedAt: NOW }
    const withPending = cartReducer(add(EMPTY_CART), { type: 'setPending', pending })
    expect(withPending.pending).toEqual(pending)
    expect(withPending.lines).toHaveLength(1)
    const cleared = cartReducer(withPending, { type: 'clearPending' })
    expect(cleared.pending).toBeUndefined()
    expect(cleared.lines).toHaveLength(1)
  })

  it('clear borra líneas, nota e intento pendiente', () => {
    const pending = { clientRequestId: 'req-1', fingerprint: 'fp', startedAt: NOW }
    let state = cartReducer(add(EMPTY_CART), { type: 'setPending', pending })
    state = cartReducer(state, { type: 'setNote', note: 'hola' })
    expect(cartReducer(state, { type: 'clear' })).toEqual(EMPTY_CART)
  })

  it('no modifica el estado recibido', () => {
    const state = add(EMPTY_CART)
    const snapshot = JSON.stringify(state)
    cartReducer(state, { type: 'setQuantity', key: state.lines[0].key, quantity: 5 })
    add(state)
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('submissionFingerprint', () => {
  const input: Omit<CreateOrderInput, 'clientRequestId'> = {
    tableId: 12,
    note: 'sin apuro',
    expectedTotalCents: 2500000,
    items: [
      { lineId: 'l1', dishId: 'burger', quantity: 2, selection: { cooking: ['rare'], extras: ['cheese', 'bacon'] }, note: 'sin sal' },
      { lineId: 'l2', dishId: 'salad', quantity: 1, selection: {} },
    ],
  }

  it('es igual para el mismo contenido aunque cambie el orden de líneas u opciones', () => {
    const shuffled: typeof input = {
      ...input,
      items: [
        { lineId: 'l2', dishId: 'salad', quantity: 1, selection: {} },
        { lineId: 'l1', dishId: 'burger', quantity: 2, selection: { extras: ['bacon', 'cheese'], cooking: ['rare'] }, note: 'sin sal' },
      ],
    }
    expect(submissionFingerprint(shuffled)).toBe(submissionFingerprint(input))
  })

  it('no depende del clientRequestId', () => {
    expect(submissionFingerprint({ ...input, clientRequestId: 'a' } as CreateOrderInput)).toBe(
      submissionFingerprint({ ...input, clientRequestId: 'b' } as CreateOrderInput),
    )
  })

  it('cambia si cambia una cantidad', () => {
    const changed = { ...input, items: [{ ...input.items[0], quantity: 3 }, input.items[1]] }
    expect(submissionFingerprint(changed)).not.toBe(submissionFingerprint(input))
  })

  it.each([
    ['la mesa', { tableId: 5 }],
    ['la nota general', { note: 'otra' }],
    ['el total esperado', { expectedTotalCents: 2600000 }],
  ])('cambia si cambia %s', (_label, patch) => {
    expect(submissionFingerprint({ ...input, ...patch })).not.toBe(submissionFingerprint(input))
  })

  it('trata nota ausente y nota vacía como lo mismo', () => {
    const withoutNote = { ...input, note: undefined }
    const emptyNote = { ...input, note: '' }
    expect(submissionFingerprint(withoutNote)).toBe(submissionFingerprint(emptyNote))
  })
})
