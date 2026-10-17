import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RESTAURANT } from '../../../src/config'
import { TopBar } from '../../../src/features/layout/TopBar'
import { ServiceError } from '../../../src/services/contracts'
import type { Order } from '../../../src/domain/types'
import { createSafeStorage } from '../../../src/services/storage'
import { createMyOrdersStore } from '../../../src/state/myOrdersStore'
import type { FakeOrderService } from '../../fixtures/fakeOrderService'
import { makeOrder } from '../../fixtures/orders'
import { createTestServices } from '../../fixtures/services'
import { createMemoryStorage } from '../../fixtures/storage'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

type GetTable = Parameters<typeof createTestServices>[0]

const NOW = '2026-10-11T13:00:00.000Z'
const o1 = makeOrder({ id: 'o1', code: 'K7F2', tableId: 12 })
const o2 = makeOrder({ id: 'o2', code: 'P3Q9', tableId: 5 })
const next = (o: Order, status: Order['status']): Order => ({ ...o, status, updatedAt: '2026-10-11T12:30:00.000Z' })

const renderBar = (
  url: string,
  { getTable, ordersOpen, orders = [], intro }: { getTable?: GetTable; ordersOpen?: boolean; orders?: Order[]; intro?: boolean } = {},
) => {
  const onOpenOrders = vi.fn()
  const services = createTestServices(getTable)
  const orderService = services.orderService as FakeOrderService
  orderService.orders = orders
  const backing = createMemoryStorage()
  const store = createMyOrdersStore({ storage: createSafeStorage(() => backing), target: new EventTarget(), now: () => NOW })
  orders.forEach((o) => store.add({ orderId: o.id, tableId: o.tableId, createdAt: o.createdAt }))
  const view = renderWithProviders(<TopBar onOpenOrders={onOpenOrders} ordersOpen={ordersOpen} intro={intro} />, {
    url,
    services,
    i18n: true,
    table: true,
    liveRegion: true,
    myOrders: true,
    myOrdersStore: store,
  })
  return { onOpenOrders, services, orderService, ...view }
}

describe('TopBar (RF4, RF42)', () => {
  beforeEach(() => window.localStorage.clear())

  it('con la entrada animada en curso (intro) sigue siendo el banner con la marca y los controles', async () => {
    const { container } = renderBar('/?mesa=12', { intro: true })
    const bar = screen.getByRole('banner')
    expect(within(bar).getByText(RESTAURANT.name)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument()
    expect(within(bar).getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('es el banner de la página y muestra la marca "Fogón"', () => {
    renderBar('/')
    const bar = screen.getByRole('banner')
    expect(within(bar).getByText(RESTAURANT.name)).toBeInTheDocument()
    expect(RESTAURANT.name).toBe('Fogón')
  })

  it('incluye el selector de idioma, que cambia el idioma de la barra', async () => {
    renderBar('/?mesa=12')
    const orders = await screen.findByRole('button', { name: 'Mis pedidos' })
    expect(within(screen.getByRole('banner')).getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(orders).toHaveAccessibleName('My orders')
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument()
  })

  describe('"Mis pedidos" solo con mesa válida', () => {
    it('con mesa válida aparece, tras verificarla', async () => {
      renderBar('/?mesa=12')
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument() // todavía verificando
      expect(await screen.findByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument()
    })

    it.each(['/', '/?mesa=abc', '/?mesa=0'])('sin mesa usable (%s) no aparece', async (url) => {
      renderBar(url)
      expect(screen.getByRole('banner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })

    it('con una mesa que el restaurante no tiene no aparece', async () => {
      const { services } = renderBar('/?mesa=50', { getTable: async () => null })
      await waitFor(() => expect(services.menuService.getTable).toHaveBeenCalled())
      await act(async () => {})
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })

    it('si la mesa no se pudo verificar no aparece', async () => {
      const { services } = renderBar('/?mesa=12', {
        getTable: async () => {
          throw new ServiceError('NETWORK', 'sin red')
        },
      })
      await waitFor(() => expect(services.menuService.getTable).toHaveBeenCalled())
      await act(async () => {})
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })
  })

  describe('el botón "Mis pedidos"', () => {
    it('llama a onOpenOrders al tocarlo', async () => {
      const { onOpenOrders } = renderBar('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }))
      expect(onOpenOrders).toHaveBeenCalledTimes(1)
    })

    it('mide al menos 44 × 44 px (min-h-11 min-w-11)', async () => {
      renderBar('/?mesa=12')
      expect(await screen.findByRole('button', { name: 'Mis pedidos' })).toHaveClass('min-h-11', 'min-w-11')
    })

    it('marca la pantalla actual con aria-current cuando "Mis pedidos" está abierto', async () => {
      const { unmount } = renderBar('/?mesa=12', { ordersOpen: true })
      expect(await screen.findByRole('button', { name: 'Mis pedidos' })).toHaveAttribute('aria-current', 'page')
      unmount()

      renderBar('/?mesa=12', { ordersOpen: false })
      expect(await screen.findByRole('button', { name: 'Mis pedidos' })).not.toHaveAttribute('aria-current')
    })
  })

  describe('contador de activos y novedad (RF42, RF47)', () => {
    it('con pedidos activos de varias mesas aparece aunque no haya mesa válida, con la cantidad en el nombre', async () => {
      renderBar('/', { orders: [o1, o2] })
      const button = await screen.findByRole('button', { name: 'Mis pedidos, 2 activos' })
      expect(within(button).getByText('2')).toBeInTheDocument()
    })

    it('un solo activo usa el singular', async () => {
      renderBar('/', { orders: [o1] })
      expect(await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })).toBeInTheDocument()
    })

    it('los pedidos en estado final no cuentan', async () => {
      renderBar('/?mesa=12', { orders: [next(o1, 'delivered'), o2] })
      expect(await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })).toBeInTheDocument()
    })

    it('sin activos y con mesa válida, el nombre es solo "Mis pedidos" y no hay contador', async () => {
      renderBar('/?mesa=12')
      const button = await screen.findByRole('button', { name: 'Mis pedidos' })
      expect(within(button).queryByText('0')).not.toBeInTheDocument()
    })

    it('un cambio de estado marca la novedad en el nombre accesible y con un punto', async () => {
      const { orderService } = renderBar('/?mesa=12', { orders: [o1] })
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted'), previousStatus: 'pending' }))

      const button = await screen.findByRole('button', { name: 'Mis pedidos, 1 activo, hay novedades' })
      expect(button.querySelector('[data-news]')).not.toBeNull()
    })

    it('sin novedad no hay punto', async () => {
      renderBar('/?mesa=12', { orders: [o1] })
      const button = await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })
      expect(button.querySelector('[data-news]')).toBeNull()
    })

    it('la novedad de un pedido que ya terminó se nombra sin la cantidad', async () => {
      const { orderService } = renderBar('/?mesa=12', { orders: [o1] })
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })

      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'delivered'), previousStatus: 'ready' }))

      expect(await screen.findByRole('button', { name: 'Mis pedidos, hay novedades' })).toBeInTheDocument()
    })

    it('se traduce al inglés', async () => {
      window.localStorage.setItem('restaurante.lang', 'en')
      renderBar('/', { orders: [o1, o2] })
      expect(await screen.findByRole('button', { name: 'My orders, 2 active' })).toBeInTheDocument()
    })

    it('no tiene violaciones de accesibilidad con contador y novedad', async () => {
      const { container, orderService } = renderBar('/', { orders: [o1, o2] })
      await screen.findByRole('button', { name: 'Mis pedidos, 2 activos' })
      act(() => orderService.emit({ type: 'order.status_changed', order: next(o1, 'accepted'), previousStatus: 'pending' }))
      await screen.findByRole('button', { name: 'Mis pedidos, 2 activos, hay novedades' })
      await expectNoA11yViolations(container)
    })
  })

  describe('material y zonas seguras (plan §9.5, mobile-native)', () => {
    it('la píldora es de vidrio, de 56 px de alto y de hasta 680 px de ancho', () => {
      renderBar('/')
      const pill = screen.getByRole('banner').querySelector('.glass')!
      expect(pill).toHaveClass('rounded-full', 'h-14', 'max-w-[680px]')
    })

    it('se separa del borde superior con la zona segura y de los laterales con 12 px o la zona segura', () => {
      renderBar('/')
      const className = screen.getByRole('banner').className
      expect(className).toContain('env(safe-area-inset-top)')
      expect(className).toContain('env(safe-area-inset-left)')
      expect(className).toContain('env(safe-area-inset-right)')
    })

    it('la capa pasa por encima del escenario con el token --z-top-bar', () => {
      renderBar('/')
      expect(screen.getByRole('banner').className).toContain('z-(--z-top-bar)')
    })
  })

  it('no tiene violaciones de accesibilidad con y sin "Mis pedidos"', async () => {
    const without = renderBar('/')
    await expectNoA11yViolations(without.container)
    without.unmount()

    const withOrders = renderBar('/?mesa=12', { ordersOpen: true })
    await screen.findByRole('button', { name: 'Mis pedidos' })
    await expectNoA11yViolations(withOrders.container)
  })
})
