import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import { createSafeStorage } from '../../src/services/storage'
import { useMyOrders } from '../../src/state/MyOrdersContext'
import type { MyOrders } from '../../src/state/MyOrdersContext'
import { createMyOrdersStore } from '../../src/state/myOrdersStore'
import type { FakeOrderService } from '../fixtures/fakeOrderService'
import { makeOrder } from '../fixtures/orders'
import { createTestServices } from '../fixtures/services'
import { createMemoryStorage } from '../fixtures/storage'
import { renderWithProviders } from '../utils'

const NOW = '2026-10-11T13:00:00.000Z'
const at = (minutes: number) => new Date(Date.parse('2026-10-11T12:00:00.000Z') + minutes * 60_000).toISOString()

const o1 = makeOrder({ id: 'o1', code: 'K7F2', tableId: 12 })
const o2 = makeOrder({ id: 'o2', code: 'P3Q9', tableId: 5, createdAt: at(5), updatedAt: at(5) })
const entryOf = (o: Order) => ({ orderId: o.id, tableId: o.tableId, createdAt: o.createdAt })
/** Una nueva versión del pedido en otro estado. */
const next = (o: Order, status: Order['status'], minutes: number): Order => ({
  ...o,
  status,
  updatedAt: at(minutes),
  statusHistory: [...o.statusHistory, { status, at: at(minutes) }],
})

let api!: MyOrders
function Probe() {
  api = useMyOrders()
  return (
    <ul aria-label="pedidos">
      {api.orders.map((o) => (
        <li key={o.id}>
          {o.code}:{o.status}
        </li>
      ))}
    </ul>
  )
}

function setup({ entries = [o1], orders = [o1], url = '/?mesa=12' }: { entries?: Order[]; orders?: Order[]; url?: string } = {}) {
  const backing = createMemoryStorage()
  const store = createMyOrdersStore({
    storage: createSafeStorage(() => backing),
    target: new EventTarget(),
    now: () => NOW,
  })
  entries.forEach((o) => store.add(entryOf(o)))
  const services = createTestServices()
  const orderService = services.orderService as FakeOrderService
  orderService.orders = orders
  const view = renderWithProviders(<Probe />, {
    url,
    services,
    i18n: true,
    table: true,
    liveRegion: true,
    myOrders: true,
    myOrdersStore: store,
  })
  return { store, orderService, ...view }
}

const listed = () => screen.queryAllByRole('listitem').map((li) => li.textContent)
const live = () => screen.getByRole('status')

describe('MyOrdersProvider: pedidos del dispositivo en tiempo real (RF28-RF31, RF39, RF40, RF42, RF47; plan §5.5)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.useRealTimers())

  describe('carga y suscripción', () => {
    it('se suscribe ANTES de pedir los pedidos y carga los registrados', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toEqual(['K7F2:pending']))

      expect(orderService.subscribe.mock.invocationCallOrder[0]).toBeLessThan(orderService.getOrders.mock.invocationCallOrder[0])
      expect(orderService.getOrders).toHaveBeenCalledWith(['o1'])
    })

    it('un evento que llega mientras carga se aplica al terminar (sin huecos)', async () => {
      const { orderService } = setup({ entries: [], orders: [] })
      await waitFor(() => expect(orderService.subscribe).toHaveBeenCalledTimes(1))
      let finish!: (orders: Order[]) => void
      orderService.getOrders.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))

      act(() => api.register(o2)) // mesa nueva: se vuelve a suscribir y se pide el pedido
      await waitFor(() => expect(orderService.subscriptions).toHaveLength(2))
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o2, 'accepted', 6), previousStatus: 'pending' }))
      await act(async () => finish([o2])) // la respuesta es anterior al evento

      await waitFor(() => expect(listed()).toEqual(['P3Q9:accepted']))
    })

    it('un evento más viejo que el dato cargado no lo pisa (RF30)', async () => {
      const loaded = next(o1, 'preparing', 20)
      const { orderService } = setup({ orders: [loaded] })
      await waitFor(() => expect(listed()).toEqual(['K7F2:preparing']))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted', 10), previousStatus: 'pending' }))

      expect(listed()).toEqual(['K7F2:preparing'])
    })

    it('el pedido de la respuesta del POST y el evento order.created no se duplican', async () => {
      const { orderService, store } = setup({ entries: [], orders: [] })
      await waitFor(() => expect(orderService.getOrders).not.toHaveBeenCalled())

      act(() => {
        orderService.emit({ type: 'order.created', order: o1 }) // el mock avisa antes de responder: todavía no está registrado
        api.register(o1)
        orderService.emit({ type: 'order.created', order: o1 })
      })

      expect(listed()).toEqual(['K7F2:pending'])
      expect(store.read().map((e) => e.orderId)).toEqual(['o1'])
    })

    it('ignora eventos de pedidos que este dispositivo no registró', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))

      act(() => orderService.emit({ type: 'order.created', order: o2 }))

      expect(listed()).toEqual(['K7F2:pending'])
    })

    it('no pide los pedidos registrados hace más de 12 horas', async () => {
      const old = makeOrder({ id: 'old', createdAt: '2026-10-10T20:00:00.000Z', updatedAt: '2026-10-10T20:00:00.000Z' })
      const { orderService, store } = setup({ entries: [], orders: [old] })
      store.add(entryOf(old))
      await act(async () => {})

      expect(orderService.getOrders).not.toHaveBeenCalledWith(expect.arrayContaining(['old']))
      expect(listed()).toEqual([])
    })
  })

  describe('todas las mesas del dispositivo (P3)', () => {
    it('incluye pedidos de otras mesas y suscribe a todas más la mesa actual', async () => {
      const { orderService } = setup({ entries: [o1, o2], orders: [o1, o2] })
      await waitFor(() => expect(listed()).toEqual(['P3Q9:pending', 'K7F2:pending']))

      expect(orderService.subscriptions[0].filter).toEqual({ kind: 'tables', tableIds: [5, 12] })
    })

    it('suscribe a la mesa actual aunque no haya pedidos', async () => {
      const { orderService } = setup({ entries: [], orders: [] })
      await waitFor(() => expect(orderService.subscriptions).toHaveLength(1))
      expect(orderService.subscriptions[0].filter).toEqual({ kind: 'tables', tableIds: [12] })
    })

    it('al cambiar el conjunto de mesas se vuelve a suscribir y se cancela la anterior', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      const o3 = makeOrder({ id: 'o3', code: 'ZZ11', tableId: 7, createdAt: at(8), updatedAt: at(8) })
      orderService.orders = [o1, o3]

      act(() => api.register(o3))

      await waitFor(() => expect(orderService.subscriptions).toHaveLength(2))
      expect(orderService.subscriptions[0].active).toBe(false)
      expect(orderService.subscriptions[1].filter).toEqual({ kind: 'tables', tableIds: [7, 12] })
      expect(listed()).toEqual(['ZZ11:pending', 'K7F2:pending'])
    })

    it('un pedido registrado en otra pestaña (evento storage) aparece', async () => {
      const { orderService, store } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      orderService.orders = [o1, o2]

      // Otra pestaña escribió el registro: aquí llega como un cambio del store.
      act(() => store.add(entryOf(o2)))

      await waitFor(() => expect(listed()).toEqual(['P3Q9:pending', 'K7F2:pending']))
    })

    it('un pedido que el restaurante ya no conoce se quita del registro', async () => {
      const { store } = setup({ entries: [o1, o2], orders: [o1] }) // el servicio omite o2
      await waitFor(() => expect(store.read().map((e) => e.orderId)).toEqual(['o1']))
      expect(listed()).toEqual(['K7F2:pending'])
    })

    it('si el refresco falla por la red, conserva el registro y lo ya cargado', async () => {
      const { orderService, store } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      orderService.getOrders.mockRejectedValueOnce(new ServiceError('NETWORK', 'sin red'))
      await act(() => api.refresh())
      expect(store.read()).toHaveLength(1)
      expect(listed()).toEqual(['K7F2:pending'])
    })
  })

  describe('refresco', () => {
    it.each([
      ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
      ['online', () => window.dispatchEvent(new Event('online'))],
    ])('en %s vuelve a pedir los pedidos y toma el estado nuevo', async (_name, fire) => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toEqual(['K7F2:pending']))
      orderService.orders = [next(o1, 'ready', 30)]

      act(() => void fire())

      await waitFor(() => expect(listed()).toEqual(['K7F2:ready']))
    })

    it('un refresco con datos más viejos nunca retrocede un pedido', async () => {
      const { orderService } = setup({ orders: [next(o1, 'ready', 30)] })
      await waitFor(() => expect(listed()).toEqual(['K7F2:ready']))
      orderService.orders = [o1]

      await act(() => api.refresh())

      expect(listed()).toEqual(['K7F2:ready'])
    })
  })

  describe('avisos de cambio de estado (RF29, RF47)', () => {
    it('la carga inicial no se anuncia ni marca novedad', async () => {
      setup({ orders: [next(o1, 'preparing', 20)] })
      await waitFor(() => expect(listed()).toHaveLength(1))
      await act(async () => {})

      expect(live()).toBeEmptyDOMElement()
      expect(api.hasNews).toBe(false)
      expect(api.lastChange).toBeNull()
    })

    it('un cambio de estado en vivo se anuncia, marca novedad y expone el último cambio', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'preparing', 20), previousStatus: 'pending' }))
      await act(async () => void vi.advanceTimersByTime(100))

      expect(live()).toHaveTextContent('Pedido K7F2: En preparación')
      expect(api.hasNews).toBe(true)
      expect(api.lastChange?.order.status).toBe('preparing')
    })

    it('clearNews apaga la novedad', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted', 10), previousStatus: 'pending' }))
      expect(api.hasNews).toBe(true)

      act(() => api.clearNews())

      expect(api.hasNews).toBe(false)
    })

    it('con "Mis pedidos" abierta se anuncia pero no hay novedad; al entrar se limpia la que había', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted', 10), previousStatus: 'pending' }))
      expect(api.hasNews).toBe(true)

      act(() => api.setViewingOrders(true))
      expect(api.hasNews).toBe(false)

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'preparing', 20), previousStatus: 'accepted' }))
      expect(api.hasNews).toBe(false)
      expect(api.lastChange?.order.status).toBe('preparing')

      act(() => api.setViewingOrders(false))
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'ready', 30), previousStatus: 'preparing' }))
      expect(api.hasNews).toBe(true)
    })

    it('repetir el mismo estado no cuenta como cambio', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted', 10), previousStatus: 'pending' }))
      act(() => api.clearNews())

      act(() => orderService.emit({ type: 'order.status_changed', order: { ...next(o1, 'accepted', 10), updatedAt: at(11) }, previousStatus: 'pending' }))

      expect(api.hasNews).toBe(false)
    })

    it('un cambio descubierto al refrescar también avisa', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(listed()).toHaveLength(1))
      orderService.orders = [next(o1, 'ready', 30)]

      await act(() => api.refresh())

      expect(api.hasNews).toBe(true)
      expect(api.lastChange?.order.code).toBe('K7F2')
    })
  })

  describe('carga inicial', () => {
    it('loading es verdadero mientras hay pedidos registrados sin cargar y se apaga al terminar', async () => {
      const { orderService } = setup({ entries: [], orders: [] })
      await waitFor(() => expect(orderService.subscribe).toHaveBeenCalledTimes(1))
      expect(api.loading).toBe(false) // sin pedidos registrados no hay nada que esperar
      let finish!: (orders: Order[]) => void
      orderService.getOrders.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))

      act(() => api.register(o2))
      await waitFor(() => expect(orderService.getOrders).toHaveBeenCalled())
      expect(api.loading).toBe(false) // el pedido registrado ya está en memoria: no se espera

      await act(async () => finish([o2]))
      expect(api.loading).toBe(false)
    })

    it('loading es verdadero con un registro previo hasta que responde el restaurante', async () => {
      const { orderService } = setup({ entries: [o1], orders: [o1] })
      expect(api.loading).toBe(true)
      await waitFor(() => expect(listed()).toEqual(['K7F2:pending']))
      expect(api.loading).toBe(false)
      expect(orderService.getOrders).toHaveBeenCalledTimes(1)
    })

    it('loading también se apaga si la carga falla', async () => {
      const backing = createMemoryStorage()
      const store = createMyOrdersStore({
        storage: createSafeStorage(() => backing),
        target: new EventTarget(),
        now: () => NOW,
      })
      store.add(entryOf(o1))
      const services = createTestServices()
      ;(services.orderService as FakeOrderService).getOrders.mockRejectedValue(new ServiceError('NETWORK', 'sin red'))
      renderWithProviders(<Probe />, { url: '/?mesa=12', services, i18n: true, table: true, liveRegion: true, myOrders: true, myOrdersStore: store })
      expect(api.loading).toBe(true)
      await waitFor(() => expect(api.loading).toBe(false))
    })
  })

  describe('activos', () => {
    it('activeOrders deja fuera los pedidos en estado final, pero orders los conserva', async () => {
      setup({ entries: [o1, o2], orders: [next(o1, 'delivered', 40), o2] })
      await waitFor(() => expect(listed()).toHaveLength(2))

      expect(api.activeOrders.map((o) => o.code)).toEqual(['P3Q9'])
      expect(api.orders.map((o) => o.code)).toEqual(['P3Q9', 'K7F2'])
    })
  })
})
