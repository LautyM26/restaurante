import { useState } from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUBMIT_TIMEOUT_MS } from '../../src/config'
import { lineKey } from '../../src/domain/cart'
import type { Menu, Order } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import { createSafeStorage } from '../../src/services/storage'
import { useCart } from '../../src/state/CartContext'
import type { Cart } from '../../src/state/CartContext'
import { cartStorageKey, parseStoredCart } from '../../src/state/cartStorage'
import { createMyOrdersStore } from '../../src/state/myOrdersStore'
import { useTable } from '../../src/state/TableContext'
import type { Table } from '../../src/state/TableContext'
import { useSubmitOrder } from '../../src/state/useSubmitOrder'
import type { SubmitOrder } from '../../src/state/useSubmitOrder'
import type { FakeOrderService } from '../fixtures/fakeOrderService'
import { burger, mains, salad, starters } from '../fixtures/menu'
import { makeOrder } from '../fixtures/orders'
import { createTestServices } from '../fixtures/services'
import { createMemoryStorage } from '../fixtures/storage'
import { renderWithProviders } from '../utils'

const menu: Menu = { categories: [starters, mains], dishes: [salad, burger] }
const KEY_12 = cartStorageKey(12)

let api!: SubmitOrder
let cart!: Cart
let table!: Table
let setMenu!: (menu: Menu | null) => void

type Store = ReturnType<typeof createMyOrdersStore>
interface Handlers {
  onSent: ReturnType<typeof vi.fn<(order: Order) => void>>
  refreshMenu: ReturnType<typeof vi.fn<() => void>>
  store: Store
}

// Sonda: ejecuta el hook dentro de los mismos providers que la app y deja su valor en `api`.
function Probe({ initialMenu, onSent, refreshMenu, store }: Handlers & { initialMenu: Menu | null }) {
  const [current, setCurrent] = useState(initialMenu)
  setMenu = setCurrent
  cart = useCart()
  table = useTable()
  api = useSubmitOrder({ menu: current, onSent, refreshMenu, store })
  return null
}

const newStore = () => {
  const backing = createMemoryStorage()
  return createMyOrdersStore({ storage: createSafeStorage(() => backing), target: new EventTarget(), now: () => '2026-10-11T13:00:00.000Z' })
}

function mount({ url = '/?mesa=12', initialMenu = menu as Menu | null } = {}) {
  const services = createTestServices()
  const orders = services.orderService as FakeOrderService
  const handlers: Handlers = { onSent: vi.fn<(order: Order) => void>(), refreshMenu: vi.fn<() => void>(), store: newStore() }
  renderWithProviders(<Probe initialMenu={initialMenu} {...handlers} />, {
    url,
    services,
    i18n: true,
    liveRegion: true,
    table: true,
    cart: true,
  })
  return { orders, ...handlers }
}

async function setup(options?: Parameters<typeof mount>[0]) {
  const mounted = mount(options)
  if (options?.url !== '/') await waitFor(() => expect(table.status).toBe('valid'))
  return mounted
}

const addSalad = (quantity = 2) => act(() => void cart.addLine({ dishId: 'salad', selection: {}, note: '', quantity }))
const saladKey = lineKey('salad', {}, '')
const rare = { cooking: ['rare'] }

const sentOrder = (overrides: Partial<Order> = {}) =>
  makeOrder({ id: 'order-9', code: 'K7F2', tableId: 12, totalCents: 1000000, ...overrides })
const network = () => new ServiceError('NETWORK', 'sin red')
const priceChanged = (totalCents: number, unitPriceCents: number) =>
  new ServiceError('PRICE_CHANGED', 'x', { totalCents, priceLines: [{ lineId: saladKey, unitPriceCents }] })

const submit = (options?: Parameters<SubmitOrder['submit']>[0]) => act(async () => api.submit(options))
const edit = () => act(async () => api.edit())

const pendingInStorage = () => parseStoredCart(window.sessionStorage.getItem(KEY_12)).pending

describe('useSubmitOrder: máquina de envío (RF24-RF27, RF46; plan §5.4)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  describe('envío correcto', () => {
    it('arma el pedido con lo que hay en el carrito y el total esperado, y lo registra', async () => {
      const { orders, onSent, store } = await setup()
      addSalad(2)
      act(() => cart.setNote('sin sal'))
      orders.createOrder.mockResolvedValue(sentOrder())

      await submit()

      expect(orders.createOrder).toHaveBeenCalledTimes(1)
      const input = orders.createOrder.mock.calls[0][0]
      expect(input).toMatchObject({
        tableId: 12,
        note: 'sin sal',
        expectedTotalCents: 1000000,
        items: [{ lineId: saladKey, dishId: 'salad', quantity: 2, selection: {} }],
      })
      expect(input.clientRequestId).toMatch(/\S{8,}/)
      expect(store.read()).toEqual([{ orderId: 'order-9', tableId: 12, createdAt: '2026-10-11T12:00:00.000Z' }])
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-9', code: 'K7F2' }))
    })

    it('al confirmarse vacía el pedido en curso (incluido el intento pendiente) y vuelve a reposo', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockResolvedValue(sentOrder())

      await submit()

      expect(cart.lines).toEqual([])
      expect(cart.pending).toBeUndefined()
      expect(api.state).toEqual({ status: 'idle' })
      expect(window.sessionStorage.getItem(KEY_12)).toBeNull()
    })

    it('anuncia el pedido enviado con su código', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockResolvedValue(sentOrder())

      await submit()

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Pedido enviado: K7F2'))
    })

    it('mientras espera la respuesta está en "sending" y bloqueado', async () => {
      const { orders } = await setup()
      addSalad(1)
      let finish!: (order: Order) => void
      orders.createOrder.mockImplementation(() => new Promise<Order>((resolve) => (finish = resolve)))

      await act(async () => {
        void api.submit()
      })
      expect(api.state).toEqual({ status: 'sending' })
      expect(api.locked).toBe(true)

      await act(async () => finish(sentOrder()))
      expect(api.locked).toBe(false)
    })
  })

  describe('doble toque e intento persistido (RF24, RF26, CL11)', () => {
    it('dos toques seguidos en "Enviar" crean un solo pedido', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockResolvedValue(sentOrder())

      await act(async () => {
        await Promise.all([api.submit(), api.submit()])
      })

      expect(orders.createOrder).toHaveBeenCalledTimes(1)
    })

    it('el intento (id y huella) ya está guardado en sessionStorage cuando se llama al restaurante', async () => {
      const { orders } = await setup()
      addSalad(1)
      let seenInStorage: ReturnType<typeof pendingInStorage>
      orders.createOrder.mockImplementation(async (input) => {
        seenInStorage = pendingInStorage()
        return sentOrder({ clientRequestId: input.clientRequestId })
      })

      await submit()

      const sentId = orders.createOrder.mock.calls[0][0].clientRequestId
      expect(seenInStorage?.clientRequestId).toBe(sentId)
      expect(seenInStorage?.fingerprint).toEqual(expect.any(String))
    })
  })

  describe('no se envía sin condiciones (RF2, RF44)', () => {
    it('sin mesa válida no llama al restaurante', async () => {
      const { orders } = await setup({ url: '/' })
      addSalad(1)

      await submit()

      expect(orders.createOrder).not.toHaveBeenCalled()
      expect(cart.pending).toBeUndefined()
    })

    it('con el carrito vacío no hace nada', async () => {
      const { orders } = await setup()

      await submit()

      expect(orders.createOrder).not.toHaveBeenCalled()
    })

    it('si una línea ya no es válida frente a la carta, no envía ni guarda un intento (CL27)', async () => {
      const { orders } = await setup()
      addSalad(1)
      act(() => setMenu({ categories: [starters, mains], dishes: [{ ...salad, available: false }, burger] }))

      await submit()

      expect(orders.createOrder).not.toHaveBeenCalled()
      expect(cart.pending).toBeUndefined()
    })

    it('sin la carta cargada no envía', async () => {
      const { orders } = await setup({ initialMenu: null })
      addSalad(1)

      await submit()

      expect(orders.createOrder).not.toHaveBeenCalled()
    })
  })

  describe('resultado desconocido: red, servidor, demora (RF26, CL12)', () => {
    it('un error de red deja el intento sin resolver y el pedido bloqueado, sin registrar nada', async () => {
      const { orders, onSent, store } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValue(network())

      await submit()

      expect(api.state).toEqual({ status: 'unresolved', resolveFailed: false, code: 'NETWORK' })
      expect(api.locked).toBe(true)
      expect(cart.pending).toBeDefined()
      expect(onSent).not.toHaveBeenCalled()
      expect(store.read()).toEqual([])
    })

    it.each(['SERVER', 'IDEMPOTENCY_CONFLICT'] as const)('%s también deja el intento sin resolver', async (code) => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValue(new ServiceError(code, 'x'))

      await submit()

      expect(api.state).toMatchObject({ status: 'unresolved', code })
      expect(api.locked).toBe(true)
    })

    it('si el restaurante no responde en 15 s lo trata como resultado desconocido', async () => {
      vi.useFakeTimers()
      const { orders } = mount()
      await act(async () => vi.advanceTimersByTimeAsync(0))
      expect(table.status).toBe('valid')
      addSalad(1)
      orders.createOrder.mockImplementation(() => new Promise<Order>(() => {}))

      await act(async () => {
        void api.submit()
      })
      expect(api.state).toEqual({ status: 'sending' })

      await act(async () => vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS - 1))
      expect(api.state).toEqual({ status: 'sending' })
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(api.state).toMatchObject({ status: 'unresolved', code: 'NETWORK' })
      expect(cart.pending).toBeDefined()
    })

    it('"Reintentar" reenvía con el MISMO clientRequestId y, si esta vez llega, lo registra', async () => {
      const { orders, onSent } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValueOnce(network()).mockResolvedValueOnce(sentOrder())

      await submit()
      await submit() // el botón "Reintentar" llama a submit()

      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input.clientRequestId)
      expect(second).toBe(first)
      expect(onSent).toHaveBeenCalledTimes(1)
      expect(cart.lines).toEqual([])
    })

    it('"Editar pedido": si el restaurante ya lo había registrado, lo trata como enviado (CL28)', async () => {
      const { orders, onSent, store } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValue(network())
      await submit()
      const id = orders.createOrder.mock.calls[0][0].clientRequestId
      orders.findByClientRequestId.mockResolvedValue(sentOrder({ clientRequestId: id }))

      await edit()

      expect(orders.findByClientRequestId).toHaveBeenCalledWith(id)
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-9' }))
      expect(store.read().map((e) => e.orderId)).toEqual(['order-9'])
      expect(cart.lines).toEqual([])
      expect(orders.createOrder).toHaveBeenCalledTimes(1)
    })

    it('"Editar pedido": si no se registró, libera la edición y el próximo envío usa un id nuevo', async () => {
      const { orders, onSent } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValueOnce(network()).mockResolvedValueOnce(sentOrder())
      await submit()
      orders.findByClientRequestId.mockResolvedValue(null)

      await edit()

      expect(api.state).toEqual({ status: 'idle' })
      expect(api.locked).toBe(false)
      expect(cart.pending).toBeUndefined()
      expect(cart.lines).toHaveLength(1)
      expect(onSent).not.toHaveBeenCalled()

      await submit()
      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input.clientRequestId)
      expect(second).not.toBe(first)
    })

    it('"Editar pedido" sin conexión sigue bloqueado y lo dice', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValue(network())
      await submit()
      orders.findByClientRequestId.mockRejectedValue(network())

      await edit()

      expect(api.state).toEqual({ status: 'unresolved', resolveFailed: true, code: 'NETWORK' })
      expect(api.locked).toBe(true)
    })

    it('si el precio cambió mientras estaba sin resolver, antes de reenviar comprueba si el intento llegó', async () => {
      const { orders, onSent } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValueOnce(network())
      await submit()
      const firstId = orders.createOrder.mock.calls[0][0].clientRequestId

      // La carta se refresca con otro precio: el contenido del envío ya no es el del intento pendiente.
      act(() => setMenu({ categories: [starters, mains], dishes: [{ ...salad, priceCents: 600000 }, burger] }))
      orders.findByClientRequestId.mockResolvedValue(sentOrder({ clientRequestId: firstId }))

      await submit()

      expect(orders.findByClientRequestId).toHaveBeenCalledWith(firstId)
      expect(orders.createOrder).toHaveBeenCalledTimes(1) // no se mandó un pedido nuevo encima
      expect(onSent).toHaveBeenCalledTimes(1)
    })

    it('ese mismo caso, si el intento no llegó, envía con un id nuevo y el total nuevo', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValueOnce(network()).mockResolvedValueOnce(sentOrder())
      await submit()
      act(() => setMenu({ categories: [starters, mains], dishes: [{ ...salad, priceCents: 600000 }, burger] }))
      orders.findByClientRequestId.mockResolvedValue(null)

      await submit()

      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input)
      expect(second.clientRequestId).not.toBe(first.clientRequestId)
      expect(second.expectedTotalCents).toBe(600000)
    })
  })

  describe('recarga con un intento pendiente (RF23, RF26)', () => {
    const seedPending = () =>
      window.sessionStorage.setItem(
        KEY_12,
        JSON.stringify({
          lines: [{ dishId: 'salad', quantity: 1, selection: {}, note: '' }],
          note: '',
          pending: { clientRequestId: 'req-viejo', fingerprint: 'huella', startedAt: '2026-10-11T12:00:00.000Z' },
        }),
      )

    it('al montar consulta el intento y, si el pedido existe, lo trata como enviado', async () => {
      seedPending()
      const services = createTestServices()
      const orders = services.orderService as FakeOrderService
      orders.findByClientRequestId.mockResolvedValue(sentOrder({ clientRequestId: 'req-viejo' }))
      const handlers: Handlers = { onSent: vi.fn<(order: Order) => void>(), refreshMenu: vi.fn<() => void>(), store: newStore() }
      renderWithProviders(<Probe initialMenu={menu} {...handlers} />, { url: '/?mesa=12', services, i18n: true, liveRegion: true, table: true, cart: true })

      await waitFor(() => expect(handlers.onSent).toHaveBeenCalledTimes(1))
      expect(orders.findByClientRequestId).toHaveBeenCalledWith('req-viejo')
      expect(cart.lines).toEqual([])
      expect(orders.createOrder).not.toHaveBeenCalled()
    })

    it('si el restaurante no lo conoce, libera la edición sin enviar nada', async () => {
      seedPending()
      const services = createTestServices()
      const orders = services.orderService as FakeOrderService
      orders.findByClientRequestId.mockResolvedValue(null)
      const handlers: Handlers = { onSent: vi.fn<(order: Order) => void>(), refreshMenu: vi.fn<() => void>(), store: newStore() }
      renderWithProviders(<Probe initialMenu={menu} {...handlers} />, { url: '/?mesa=12', services, i18n: true, liveRegion: true, table: true, cart: true })

      await waitFor(() => expect(cart.pending).toBeUndefined())
      expect(cart.lines).toHaveLength(1)
      expect(api.locked).toBe(false)
      expect(orders.createOrder).not.toHaveBeenCalled()
    })

    it('si no puede consultarlo queda bloqueado y vuelve a probar cuando vuelve la conexión', async () => {
      seedPending()
      const services = createTestServices()
      const orders = services.orderService as FakeOrderService
      orders.findByClientRequestId.mockRejectedValueOnce(network())
      const handlers: Handlers = { onSent: vi.fn<(order: Order) => void>(), refreshMenu: vi.fn<() => void>(), store: newStore() }
      renderWithProviders(<Probe initialMenu={menu} {...handlers} />, { url: '/?mesa=12', services, i18n: true, liveRegion: true, table: true, cart: true })
      await waitFor(() => expect(api.state).toMatchObject({ status: 'unresolved', resolveFailed: true }))
      expect(api.locked).toBe(true)

      orders.findByClientRequestId.mockResolvedValue(sentOrder({ clientRequestId: 'req-viejo' }))
      act(() => void window.dispatchEvent(new Event('online')))

      await waitFor(() => expect(handlers.onSent).toHaveBeenCalledTimes(1))
    })
  })

  describe('el restaurante rechaza el pedido: no queda nada sin resolver (RF27, RF46)', () => {
    it('PRICE_CHANGED frena el envío: muestra los totales y las líneas que cambiaron, sin registrar ni vaciar', async () => {
      const { orders, onSent, store, refreshMenu } = await setup()
      addSalad(2)
      orders.createOrder.mockRejectedValue(priceChanged(1400000, 700000))

      await submit()

      expect(api.state).toEqual({
        status: 'priceChanged',
        oldTotalCents: 1000000,
        newTotalCents: 1400000,
        changedLines: [{ lineId: saladKey, oldUnitCents: 500000, newUnitCents: 700000 }],
      })
      expect(onSent).not.toHaveBeenCalled()
      expect(store.read()).toEqual([])
      expect(cart.lines).toHaveLength(1)
      expect(cart.pending).toBeUndefined()
      expect(api.locked).toBe(false)
      expect(refreshMenu).toHaveBeenCalled()
    })

    it('solo informa las líneas cuyo precio cambió', async () => {
      const { orders } = await setup()
      addSalad(1)
      act(() => void cart.addLine({ dishId: 'burger', selection: rare, note: '', quantity: 1 }))
      const burgerKey = lineKey('burger', rare, '')
      orders.createOrder.mockRejectedValue(
        new ServiceError('PRICE_CHANGED', 'x', {
          totalCents: 1800000,
          priceLines: [
            { lineId: saladKey, unitPriceCents: 500000 },
            { lineId: burgerKey, unitPriceCents: 1300000 },
          ],
        }),
      )

      await submit()

      expect(api.state).toMatchObject({ changedLines: [{ lineId: burgerKey, oldUnitCents: 1200000, newUnitCents: 1300000 }] })
    })

    it('"Aceptar y enviar" manda el total nuevo con un id nuevo y, si llega, registra el pedido', async () => {
      const { orders, onSent } = await setup()
      addSalad(2)
      orders.createOrder.mockRejectedValueOnce(priceChanged(1400000, 700000)).mockResolvedValueOnce(sentOrder({ totalCents: 1400000 }))
      await submit()

      await submit({ expectedTotalCents: 1400000 })

      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input)
      expect(second.expectedTotalCents).toBe(1400000)
      expect(second.clientRequestId).not.toBe(first.clientRequestId)
      expect(onSent).toHaveBeenCalledTimes(1)
    })

    it('"Revisar pedido" (dismiss) vuelve a reposo con el pedido como estaba (CL38)', async () => {
      const { orders, onSent } = await setup()
      addSalad(2)
      orders.createOrder.mockRejectedValue(priceChanged(1400000, 700000))
      await submit()

      act(() => api.dismiss())

      expect(api.state).toEqual({ status: 'idle' })
      expect(cart.lines[0].quantity).toBe(2)
      expect(orders.createOrder).toHaveBeenCalledTimes(1)
      expect(onSent).not.toHaveBeenCalled()
    })

    it('si se edita el pedido, el aviso de precio ya no corresponde y desaparece', async () => {
      const { orders } = await setup()
      addSalad(2)
      orders.createOrder.mockRejectedValue(priceChanged(1400000, 700000))
      await submit()

      act(() => cart.setQuantity(saladKey, 3))

      expect(api.state).toEqual({ status: 'idle' })
    })

    it('LINES_REJECTED guarda qué líneas y por qué (también dos líneas del mismo plato, por opción), libera el intento y refresca la carta', async () => {
      const { orders, refreshMenu } = await setup()
      act(() => void cart.addLine({ dishId: 'burger', selection: rare, note: '', quantity: 1 }))
      act(() => void cart.addLine({ dishId: 'burger', selection: { cooking: ['medium'] }, note: '', quantity: 1 }))
      const rareKey = lineKey('burger', rare, '')
      const rejected = { lineId: rareKey, dishId: 'burger', reason: 'option_unavailable', groupId: 'cooking', optionId: 'rare' } as const
      orders.createOrder.mockRejectedValue(new ServiceError('LINES_REJECTED', 'x', { lines: [rejected] }))

      await submit()

      expect(api.state).toEqual({ status: 'rejected', lines: [rejected] })
      expect(cart.pending).toBeUndefined()
      expect(cart.lines).toHaveLength(2)
      expect(refreshMenu).toHaveBeenCalled()
    })

    it('el rechazo deja de mostrarse cuando se quitan las líneas rechazadas', async () => {
      const { orders } = await setup()
      addSalad(1)
      act(() => void cart.addLine({ dishId: 'burger', selection: rare, note: '', quantity: 1 }))
      orders.createOrder.mockRejectedValue(
        new ServiceError('LINES_REJECTED', 'x', { lines: [{ lineId: saladKey, dishId: 'salad', reason: 'dish_unavailable' }] }),
      )
      await submit()
      expect(api.state.status).toBe('rejected')

      act(() => cart.removeLine(saladKey))

      expect(api.state).toEqual({ status: 'idle' })
    })

    it('INVALID_TABLE marca la mesa como inválida, conserva el pedido en curso y libera el intento (CL1)', async () => {
      const { orders, onSent } = await setup()
      addSalad(2)
      orders.createOrder.mockRejectedValue(new ServiceError('INVALID_TABLE', 'x'))

      await submit()

      expect(table.status).toBe('invalid')
      expect(api.state).toEqual({ status: 'error', code: 'INVALID_TABLE' })
      expect(cart.lines.map((l) => l.quantity)).toEqual([2])
      expect(cart.pending).toBeUndefined()
      expect(onSent).not.toHaveBeenCalled()
    })

    it('VALIDATION libera el intento, refresca la carta y avisa', async () => {
      const { orders, refreshMenu } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValue(new ServiceError('VALIDATION', 'x'))

      await submit()

      expect(api.state).toEqual({ status: 'error', code: 'VALIDATION' })
      expect(cart.pending).toBeUndefined()
      expect(cart.lines).toHaveLength(1)
      expect(refreshMenu).toHaveBeenCalled()
    })

    it('tras un rechazo el siguiente envío usa un id nuevo', async () => {
      const { orders } = await setup()
      addSalad(1)
      orders.createOrder.mockRejectedValueOnce(new ServiceError('VALIDATION', 'x')).mockResolvedValueOnce(sentOrder())

      await submit()
      await submit()

      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input.clientRequestId)
      expect(second).not.toBe(first)
    })
  })
})
