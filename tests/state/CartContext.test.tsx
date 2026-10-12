import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseTableParam } from '../../src/domain/table'
import { CartProvider, TableCartProvider, useCart } from '../../src/state/CartContext'
import type { Cart } from '../../src/state/CartContext'
import { TableProvider } from '../../src/state/TableContext'
import { ServicesProvider } from '../../src/services/ServicesContext'
import { createTestServices } from '../fixtures/services'

const KEY_12 = 'restaurante.cart.table-12'

// Sonda: deja el valor vigente del contexto en `cart` para llamarlo desde los tests.
let cart!: Cart
function Probe() {
  cart = useCart()
  return <output aria-label="unidades">{cart.units}</output>
}

const renderCart = (tableId: number | null) =>
  render(
    <CartProvider tableId={tableId}>
      <Probe />
    </CartProvider>,
  )

const add = (input: Partial<Parameters<Cart['addLine']>[0]> = {}) => {
  let result!: ReturnType<Cart['addLine']>
  act(() => {
    result = cart.addLine({ dishId: 'burger', selection: {}, note: '', quantity: 1, ...input })
  })
  return result
}

describe('CartContext: pedido en curso por mesa (RF19, RF20, RF23, RNF8)', () => {
  beforeEach(() => window.sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('arranca vacío', () => {
    renderCart(12)
    expect(cart.lines).toEqual([])
    expect(cart.units).toBe(0)
    expect(cart.note).toBe('')
    expect(cart.pending).toBeUndefined()
  })

  it('addLine suma una línea y las unidades', () => {
    renderCart(12)
    add({ dishId: 'burger', selection: { cooking: ['rare'] }, quantity: 2 })
    add({ dishId: 'salad', quantity: 1 })

    expect(cart.lines.map((l) => [l.dishId, l.quantity])).toEqual([
      ['burger', 2],
      ['salad', 1],
    ])
    expect(screen.getByLabelText('unidades')).toHaveTextContent('3')
  })

  it('la misma configuración (aunque cambie el orden de las opciones) se fusiona y no avisa tope', () => {
    renderCart(12)
    add({ selection: { extras: ['cheese', 'bacon'] }, quantity: 2 })
    const result = add({ selection: { extras: ['bacon', 'cheese'] }, quantity: 3 })

    expect(result.capped).toBe(false)
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0].quantity).toBe(5)
  })

  it('otra nota u otras opciones son otra línea', () => {
    renderCart(12)
    add({ note: '' })
    add({ note: 'sin sal' })
    add({ selection: { cooking: ['rare'] } })
    expect(cart.lines).toHaveLength(3)
  })

  it('superar 20 al fusionar deja 20 y avisa el tope (P6)', () => {
    renderCart(12)
    add({ quantity: 15 })
    const result = add({ quantity: 8 })

    expect(result.capped).toBe(true)
    expect(cart.lines[0].quantity).toBe(20)
  })

  it('llegar justo a 20 no es tope', () => {
    renderCart(12)
    add({ quantity: 15 })
    expect(add({ quantity: 5 }).capped).toBe(false)
    expect(cart.lines[0].quantity).toBe(20)
  })

  it('setQuantity, removeLine y setNote actualizan el pedido', () => {
    renderCart(12)
    add({ dishId: 'a' })
    add({ dishId: 'b' })
    const [a, b] = cart.lines

    act(() => cart.setQuantity(a.key, 7))
    act(() => cart.removeLine(b.key))
    act(() => cart.setNote('Para compartir'))

    expect(cart.lines.map((l) => [l.dishId, l.quantity])).toEqual([['a', 7]])
    expect(cart.note).toBe('Para compartir')
  })

  describe('persistencia por mesa en sessionStorage (RF23)', () => {
    it('guarda solo ids y selección bajo la clave de la mesa', () => {
      renderCart(12)
      add({ dishId: 'burger', selection: { cooking: ['rare'] }, quantity: 2, note: 'sin sal' })

      const stored = JSON.parse(window.sessionStorage.getItem(KEY_12)!)
      expect(stored.lines).toEqual([
        { dishId: 'burger', quantity: 2, selection: { cooking: ['rare'] }, note: 'sin sal' },
      ])
    })

    it('al recargar (remontar) se rehidrata con líneas, nota general e intento pendiente', () => {
      const first = renderCart(12)
      add({ dishId: 'burger', selection: { cooking: ['rare'] }, quantity: 2 })
      act(() => cart.setNote('Es un cumpleaños'))
      act(() => cart.setPending({ clientRequestId: 'req-1', fingerprint: 'fp-1', startedAt: '2026-01-01T10:00:00Z' }))
      first.unmount()

      renderCart(12)
      expect(cart.lines).toHaveLength(1)
      expect(cart.lines[0]).toMatchObject({ dishId: 'burger', quantity: 2, selection: { cooking: ['rare'] } })
      expect(cart.note).toBe('Es un cumpleaños')
      expect(cart.pending).toEqual({ clientRequestId: 'req-1', fingerprint: 'fp-1', startedAt: '2026-01-01T10:00:00Z' })
    })

    it('clearPending quita solo el intento y lo persiste', () => {
      const first = renderCart(12)
      add()
      act(() => cart.setPending({ clientRequestId: 'r', fingerprint: 'f', startedAt: '2026-01-01T10:00:00Z' }))
      act(() => cart.clearPending())
      first.unmount()

      renderCart(12)
      expect(cart.pending).toBeUndefined()
      expect(cart.lines).toHaveLength(1)
    })

    it('otra mesa tiene otro pedido en curso, sin mezclarse (CL2)', () => {
      const first = renderCart(12)
      add({ dishId: 'burger' })
      first.unmount()

      const second = renderCart(5)
      expect(cart.lines).toEqual([])
      add({ dishId: 'salad' })
      second.unmount()

      renderCart(12)
      expect(cart.lines.map((l) => l.dishId)).toEqual(['burger'])
    })

    it('cambiar de mesa en caliente muestra el pedido de la otra mesa', () => {
      const view = renderCart(12)
      add({ dishId: 'burger' })

      view.rerender(
        <CartProvider tableId={5}>
          <Probe />
        </CartProvider>,
      )
      expect(cart.lines).toEqual([])
      expect(window.sessionStorage.getItem(KEY_12)).not.toBeNull()
    })

    it('clear vacía el pedido y borra la clave guardada', () => {
      renderCart(12)
      add()
      expect(window.sessionStorage.getItem(KEY_12)).not.toBeNull()

      act(() => cart.clear())
      expect(cart.lines).toEqual([])
      expect(window.sessionStorage.getItem(KEY_12)).toBeNull()
    })

    it('vaciar la última línea borra la clave (no queda basura)', () => {
      renderCart(12)
      add()
      act(() => cart.removeLine(cart.lines[0].key))
      expect(window.sessionStorage.getItem(KEY_12)).toBeNull()
    })

    it('un dato guardado dañado no rompe: arranca vacío', () => {
      window.sessionStorage.setItem(KEY_12, '{{{ roto')
      renderCart(12)
      expect(cart.lines).toEqual([])
    })

    it('sin mesa (null) funciona en memoria y no escribe nada', () => {
      renderCart(null)
      add()
      expect(cart.lines).toHaveLength(1)
      expect(window.sessionStorage.length).toBe(0)
    })
  })

  describe('con el almacenamiento bloqueado (RNF8, CL23)', () => {
    it('agrega, cambia y sigue funcionando sin lanzar', () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('Bloqueado', 'SecurityError')
      })
      renderCart(12)

      expect(() => add({ quantity: 2 })).not.toThrow()
      expect(cart.lines[0].quantity).toBe(2)
      act(() => cart.setQuantity(cart.lines[0].key, 4))
      expect(cart.lines[0].quantity).toBe(4)
    })

    it('si guardar falla a mitad de camino (cuota) el pedido sigue en memoria', () => {
      renderCart(12)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Cuota', 'QuotaExceededError')
      })
      expect(() => add()).not.toThrow()
      expect(cart.lines).toHaveLength(1)
    })
  })

  it('useCart fuera del provider avisa con un mensaje claro', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/CartProvider/)
    quiet.mockRestore()
  })
})

describe('TableCartProvider: toma la mesa del TableProvider', () => {
  beforeEach(() => window.sessionStorage.clear())

  function renderWithTable(search: string) {
    window.history.replaceState(null, '', `/${search}`)
    return render(
      <ServicesProvider services={createTestServices()}>
        <TableProvider parsed={parseTableParam(window.location.search)}>
          <TableCartProvider>
            <Probe />
          </TableCartProvider>
        </TableProvider>
      </ServicesProvider>,
    )
  }

  it('con ?mesa=12 guarda y rehidrata el pedido de la mesa 12', () => {
    const first = renderWithTable('?mesa=12')
    add({ dishId: 'burger' })
    expect(window.sessionStorage.getItem(KEY_12)).not.toBeNull()
    first.unmount()

    renderWithTable('?mesa=12')
    expect(cart.lines.map((l) => l.dishId)).toEqual(['burger'])
  })

  it('sin mesa válida el pedido no se guarda', () => {
    renderWithTable('')
    add()
    expect(window.sessionStorage.length).toBe(0)
  })
})
