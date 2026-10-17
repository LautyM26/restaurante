import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../../../src/domain/types'
import { OrdersScreen } from '../../../src/features/orders/OrdersScreen'
import { useI18n } from '../../../src/i18n/I18nContext'
import { createSafeStorage } from '../../../src/services/storage'
import { useMyOrders } from '../../../src/state/MyOrdersContext'
import type { MyOrders } from '../../../src/state/MyOrdersContext'
import { createMyOrdersStore } from '../../../src/state/myOrdersStore'
import type { FakeOrderService } from '../../fixtures/fakeOrderService'
import { makeOrder } from '../../fixtures/orders'
import { createTestServices } from '../../fixtures/services'
import { createMemoryStorage } from '../../fixtures/storage'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const NOW = '2026-10-11T13:00:00.000Z'
const at = (minutes: number) => new Date(Date.parse('2026-10-11T12:00:00.000Z') + minutes * 60_000).toISOString()

const o1 = makeOrder({ id: 'o1', code: 'K7F2', tableId: 12, totalCents: 1250000 })
const o2 = makeOrder({ id: 'o2', code: 'P3Q9', tableId: 5, createdAt: at(5), updatedAt: at(5) })
const next = (o: Order, status: Order['status'], minutes: number): Order => ({
  ...o,
  status,
  updatedAt: at(minutes),
  statusHistory: [...o.statusHistory, { status, at: at(minutes) }],
})

let news!: MyOrders
function Probe() {
  news = useMyOrders()
  const { setLang } = useI18n()
  return <button onClick={() => setLang('en')}>to-en</button>
}

function setup({
  orders = [o1],
  url = '/?mesa=12',
  highlightId = null,
}: { orders?: Order[]; url?: string; highlightId?: string | null } = {}) {
  const backing = createMemoryStorage()
  const store = createMyOrdersStore({ storage: createSafeStorage(() => backing), target: new EventTarget(), now: () => NOW })
  orders.forEach((o) => store.add({ orderId: o.id, tableId: o.tableId, createdAt: o.createdAt }))
  const services = createTestServices()
  const orderService = services.orderService as FakeOrderService
  orderService.orders = orders
  const onBack = vi.fn()
  const view = renderWithProviders(
    <>
      <Probe />
      <OrdersScreen highlightId={highlightId} onBack={onBack} />
    </>,
    { url, services, i18n: true, table: true, liveRegion: true, myOrders: true, myOrdersStore: store },
  )
  return { orderService, store, onBack, ...view }
}

const live = () => screen.getByRole('status')
const cards = () => screen.queryAllByRole('article')

describe('OrdersScreen: "Mis pedidos" (RF25, RF28-RF32, RF42; CL30, CL39)', () => {
  beforeEach(() => window.localStorage.clear())

  describe('vacío', () => {
    it('con mesa válida y sin pedidos: mensaje y "Ver la carta"', async () => {
      const { onBack } = setup({ orders: [] })
      expect(await screen.findByText('Todavía no enviaste pedidos desde este celular.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('sin pedidos y sin mesa válida: el aviso de mesa y el acceso a la carta (CL30)', async () => {
      const { onBack } = setup({ orders: [], url: '/' })
      expect(screen.getByText('Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('lista', () => {
    it('muestra los pedidos de todas las mesas del dispositivo aun sin mesa válida (CL30)', async () => {
      setup({ orders: [o1, o2], url: '/' })
      await waitFor(() => expect(cards()).toHaveLength(2))
      expect(screen.getByText('Mesa 12')).toBeInTheDocument()
      expect(screen.getByText('Mesa 5')).toBeInTheDocument()
      // hay pedidos: no se ofrece el aviso de mesa como si no hubiera nada
      expect(screen.queryByText('Todavía no enviaste pedidos desde este celular.')).not.toBeInTheDocument()
    })

    it('tiene un título h1 y "Pedir algo más" vuelve a la carta', async () => {
      const { onBack } = setup()
      expect(screen.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeInTheDocument()
      await waitFor(() => expect(cards()).toHaveLength(1))

      await userEvent.click(screen.getByRole('button', { name: 'Pedir algo más' }))
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('destaca el pedido recién enviado con su código y total (RF25)', async () => {
      setup({ orders: [o1, o2], highlightId: 'o1' })
      await waitFor(() => expect(cards()).toHaveLength(2))
      const highlighted = cards().find((card) => within(card).queryByText('Pedido enviado'))!
      expect(within(highlighted).getByText('K7F2')).toBeInTheDocument()
      expect(within(highlighted).getAllByText(/12\.500/).length).toBeGreaterThan(0)
      expect(cards().filter((card) => within(card).queryByText('Pedido enviado'))).toHaveLength(1)
    })

    it('un pedido que ya estaba entregado al abrir no se lista (CL39)', async () => {
      setup({ orders: [next(o1, 'delivered', 40), o2] })
      await waitFor(() => expect(cards()).toHaveLength(1))
      expect(screen.getByText('P3Q9')).toBeInTheDocument()
      expect(screen.queryByText('K7F2')).not.toBeInTheDocument()
    })
  })

  describe('tiempo real y anuncios (RF29, RF31)', () => {
    it('un cambio de estado actualiza la tarjeta y se anuncia', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      const { orderService } = setup()
      await waitFor(() => expect(cards()).toHaveLength(1))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'preparing', 20), previousStatus: 'pending' }))
      await act(async () => void vi.advanceTimersByTime(100))

      expect(within(cards()[0]).getAllByText('En preparación').length).toBeGreaterThan(0)
      expect(live()).toHaveTextContent('Pedido K7F2: En preparación')
      vi.useRealTimers()
    })

    it('la carga inicial no se anuncia', async () => {
      setup({ orders: [next(o1, 'preparing', 20)] })
      await waitFor(() => expect(cards()).toHaveLength(1))
      await act(async () => {})
      expect(live()).toBeEmptyDOMElement()
    })

    it('con la pantalla abierta no deja novedad pendiente', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(cards()).toHaveLength(1))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted', 10), previousStatus: 'pending' }))

      expect(news.hasNews).toBe(false)
    })

    it('un pedido que pasa a entregado sigue visible mientras se mira la pantalla (CL39)', async () => {
      const { orderService } = setup({ orders: [o1, o2] })
      await waitFor(() => expect(cards()).toHaveLength(2))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'delivered', 40), previousStatus: 'ready' }))

      expect(cards()).toHaveLength(2)
      expect(within(screen.getByText('K7F2').closest('article')!).getAllByText('Entregado').length).toBeGreaterThan(0)
    })

    it('uno cancelado también sigue visible con su mensaje', async () => {
      const { orderService } = setup()
      await waitFor(() => expect(cards()).toHaveLength(1))

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'cancelled', 12), previousStatus: 'pending' }))

      expect(screen.getByText('Este pedido fue cancelado. Consultá con el personal.')).toBeInTheDocument()
    })
  })

  it('cambiar de idioma traduce la pantalla', async () => {
    setup()
    await waitFor(() => expect(cards()).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))

    expect(screen.getByRole('heading', { level: 1, name: 'My orders' })).toBeInTheDocument()
    expect(screen.getByText('Table 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Order something else' })).toBeInTheDocument()
  })

  it.each([
    ['vacío con mesa', { orders: [] }],
    ['vacío sin mesa', { orders: [], url: '/' }],
    ['con dos pedidos', { orders: [o1, o2] }],
    ['con el recién enviado', { orders: [o1], highlightId: 'o1' }],
  ] as const)('no tiene violaciones de accesibilidad (%s)', async (_name, options) => {
    const { container } = setup({ ...options, orders: [...options.orders] })
    await act(async () => {})
    await expectNoA11yViolations(container)
  })
})
