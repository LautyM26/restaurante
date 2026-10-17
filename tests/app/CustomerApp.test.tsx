import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerApp } from '../../src/app/CustomerApp'
import type { Order } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import type { FakeOrderService } from '../fixtures/fakeOrderService'
import { makeOrder } from '../fixtures/orders'
import { createTestServices } from '../fixtures/services'
import { menu as fixtureMenu, salad } from '../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

type GetTable = Parameters<typeof createTestServices>[0]
type GetMenu = Parameters<typeof createTestServices>[1]

const NOTICE_ES = 'Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.'

// La región viva va siempre: MenuScreen anuncia el envío del pedido y la necesita montada (como en App).
const renderApp = (url: string, getTable?: GetTable, getMenu?: GetMenu, liveRegion = true) => {
  const services = createTestServices(getTable, getMenu)
  return {
    services,
    ...renderWithProviders(<CustomerApp />, { url, services, i18n: true, table: true, cart: true, liveRegion, myOrders: true }),
  }
}

const setScrollY = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })

describe('CustomerApp: esqueleto de la app (RF1, RF2, RF3, RF4, RF32, RF41, RF42)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    setScrollY(0)
  })

  describe('la carta y la mesa', () => {
    it('con ?mesa=12 muestra "Mesa 12" tras verificarla, la barra y no muestra el aviso', async () => {
      renderApp('/?mesa=12')
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(screen.getByRole('banner')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument()
      expect(screen.queryByText(NOTICE_ES)).not.toBeInTheDocument()
    })

    it('con ?mesa=012 muestra la mesa 12', async () => {
      renderApp('/?mesa=012')
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
    })

    it('mientras verifica la mesa avisa "Verificando tu mesa" y todavía no muestra "Mesa 12"', () => {
      renderApp('/?mesa=12', () => new Promise(() => {}))
      expect(screen.getByText('Verificando tu mesa').closest('[role="status"]')).toBeInTheDocument()
      expect(screen.queryByText('Mesa 12')).not.toBeInTheDocument()
    })

    it('sin mesa muestra el aviso, no muestra mesa ni "Mis pedidos" y deja la carta a la vista', () => {
      const { container } = renderApp('/')
      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
      expect(screen.queryByText(/^Mesa \d+$/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument()
      expect(container.querySelector('main section#carta')).toBeInTheDocument()
    })

    it.each(['/?mesa=abc', '/?mesa=0', '/?mesa='])('%s muestra el aviso', (url) => {
      renderApp(url)
      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
    })

    it('?mesa=50 (no existe) muestra el aviso y nunca "Mesa 50"', async () => {
      renderApp('/?mesa=50', async () => null)
      expect(await screen.findByText(NOTICE_ES)).toBeInTheDocument()
      expect(screen.queryByText('Mesa 50')).not.toBeInTheDocument()
    })

    it('si no se puede verificar muestra "Reintentar" y al reintentar con éxito aparece "Mesa 12"', async () => {
      let calls = 0
      renderApp('/?mesa=12', async (id) => {
        if (++calls === 1) throw new ServiceError('NETWORK', 'sin red')
        return { id }
      })
      await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    })

    it('la barra queda fuera de main y la carta dentro', async () => {
      renderApp('/?mesa=12')
      await screen.findByText('Mesa 12')
      const main = screen.getByRole('main')
      expect(within(main).getByText('Mesa 12')).toBeInTheDocument()
      expect(main).not.toContainElement(screen.getByRole('banner'))
    })

    it('traduce el aviso al cambiar de idioma desde la barra', async () => {
      renderApp('/')
      await userEvent.click(screen.getByRole('radio', { name: 'English' }))
      expect(screen.getByText('To order, scan the QR code on your table or ask our staff.')).toBeInTheDocument()
    })
  })

  describe('navegación por hash (RF32)', () => {
    it('arranca en la carta con un hash desconocido', () => {
      renderApp('/#/nope')
      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })

    it('con #/orders abre "Mis pedidos" y no muestra la carta', async () => {
      const { container } = renderApp('/?mesa=12#/orders')
      expect(screen.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeInTheDocument()
      expect(container.querySelector('#carta')).not.toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Mis pedidos' })).toHaveAttribute('aria-current', 'page')
    })

    it('al abrir directo #/orders no roba el foco', () => {
      renderApp('/?mesa=12#/orders')
      expect(document.body).toHaveFocus()
    })

    it('"Mis pedidos" de la barra navega a #/orders, conserva ?mesa y mueve el foco al título', async () => {
      renderApp('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }))

      const title = screen.getByRole('heading', { level: 1, name: 'Mis pedidos' })
      expect(window.location.hash).toBe('#/orders')
      expect(window.location.search).toBe('?mesa=12')
      expect(title).toHaveFocus()
      expect(screen.queryByText('Mesa 12')).not.toBeInTheDocument()
    })

    it('el "atrás" del navegador vuelve a la carta con la mesa y el foco en el contenido', async () => {
      renderApp('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }))

      act(() => window.history.back())

      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Mis pedidos' })).not.toBeInTheDocument()
      expect(window.location.hash).toBe('')
      expect(screen.getByRole('main')).toHaveFocus()
    })

    it('"Ver la carta" del estado vacío vuelve a la carta (hace history.back si se vino de ella)', async () => {
      renderApp('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }))
      const back = vi.spyOn(window.history, 'back')

      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))

      expect(back).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
    })

    it('"Ver la carta" tras entrar directo a #/orders reemplaza la entrada y muestra la carta', async () => {
      renderApp('/?mesa=12#/orders')
      const back = vi.spyOn(window.history, 'back')

      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))

      expect(back).not.toHaveBeenCalled()
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(window.location.hash).toBe('#/')
    })

    it('"Mis pedidos" sin mesa válida llega por URL y muestra el título', () => {
      renderApp('/#/orders')
      expect(screen.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })
  })

  describe('posición de la carta al volver (RF32)', () => {
    it('restaura la posición exacta en que estaba la carta', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      renderApp('/?mesa=12')
      await screen.findByText('Mesa 12')

      setScrollY(340)
      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0)

      setScrollY(0) // en "Mis pedidos" la página es corta
      act(() => window.history.back())
      await screen.findByText('Mesa 12')
      expect(scrollTo).toHaveBeenLastCalledWith(0, 340)
    })

    it('una segunda vuelta guarda la posición nueva, no la primera', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      renderApp('/?mesa=12')
      await screen.findByText('Mesa 12')

      setScrollY(100)
      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))
      act(() => window.history.back())
      await screen.findByText('Mesa 12')
      expect(scrollTo).toHaveBeenLastCalledWith(0, 100)

      setScrollY(520)
      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))
      act(() => window.history.back())
      await screen.findByText('Mesa 12')
      expect(scrollTo).toHaveBeenLastCalledWith(0, 520)
    })

    it('al cargar no desplaza la página ni mueve el foco', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      renderApp('/?mesa=12')
      await screen.findByText('Mesa 12')
      expect(scrollTo).not.toHaveBeenCalled()
      expect(document.body).toHaveFocus()
    })

    it('toma el control de la restauración del navegador para que no compita con la propia', () => {
      renderApp('/')
      if ('scrollRestoration' in window.history) expect(window.history.scrollRestoration).toBe('manual')
    })
  })

  describe('la carta (T6: RF7-RF13, RF45)', () => {
    const withMenu = async () => fixtureMenu

    it('con ?mesa=12 muestra la mesa, las pestañas y las categorías con sus platos', async () => {
      renderApp('/?mesa=12', undefined, withMenu)

      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(await screen.findByRole('navigation', { name: 'Categorías de la carta' })).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Entradas', 'Principales'])
      expect(screen.getByRole('button', { name: 'burger' })).toBeEnabled()
    })

    it('mientras carga la carta muestra los marcadores dentro de la sección #carta', () => {
      const { container } = renderApp('/?mesa=12', undefined, () => new Promise(() => {}))
      expect(container.querySelector('main section#carta [aria-busy="true"]')).toBeInTheDocument()
    })

    it('sin mesa la carta se ve completa (solo lectura) y el aviso explica por qué no se puede pedir', async () => {
      renderApp('/', undefined, withMenu)

      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
      expect(await screen.findByRole('navigation', { name: 'Categorías de la carta' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Principales' })).toBeInTheDocument()
      // Los platos se pueden mirar; qué se puede hacer con ellos sin mesa lo decide la ficha (T7)
      expect(screen.getByRole('button', { name: 'burger' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'sold_out' })).toBeDisabled()
    })

    it('con una mesa inexistente también deja leer la carta', async () => {
      renderApp('/?mesa=50', async () => null, withMenu)
      expect(await screen.findByText(NOTICE_ES)).toBeInTheDocument()
      expect(await screen.findByRole('heading', { level: 2, name: 'Entradas' })).toBeInTheDocument()
    })

    it('si la mesa no se puede verificar la carta se carga igual, cada una con su aviso', async () => {
      renderApp(
        '/?mesa=12',
        async () => {
          throw new ServiceError('NETWORK', 'sin red')
        },
        withMenu,
      )
      expect(await screen.findByText('No pudimos verificar tu mesa. Revisá tu conexión.')).toBeInTheDocument()
      expect(await screen.findByRole('heading', { level: 2, name: 'Entradas' })).toBeInTheDocument()
    })

    it('si la carta falla muestra el error con Reintentar, y la mesa sigue visible', async () => {
      let calls = 0
      const { services } = renderApp('/?mesa=12', undefined, async () => {
        if (++calls === 1) throw new ServiceError('SERVER', 'caído')
        return fixtureMenu
      })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('No pudimos cargar la carta.')
      expect(screen.getByText('Mesa 12')).toBeInTheDocument()

      await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }))
      expect(await screen.findByRole('heading', { level: 2, name: 'Entradas' })).toBeInTheDocument()
      expect(services.menuService.getMenu).toHaveBeenCalledTimes(2)
    })

    it('ir a "Mis pedidos" y volver conserva la carta cargada, sin volver a pedirla ni mostrar marcadores', async () => {
      const { services, container } = renderApp('/?mesa=12', undefined, withMenu)
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })

      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))
      expect(screen.queryByRole('heading', { level: 2, name: 'Entradas' })).not.toBeInTheDocument()

      act(() => window.history.back())
      expect(await screen.findByRole('heading', { level: 2, name: 'Entradas' })).toBeInTheDocument()
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument()
      expect(services.menuService.getMenu).toHaveBeenCalledTimes(1)
    })

    it('volver a primer plano refresca la carta aunque se esté en "Mis pedidos"', async () => {
      const { services } = renderApp('/?mesa=12', undefined, withMenu)
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })
      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => expect(services.menuService.getMenu).toHaveBeenCalledTimes(2))
    })

    it('la restauración del scroll sigue funcionando con la carta real', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      renderApp('/?mesa=12', undefined, withMenu)
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })

      setScrollY(900)
      await userEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }))
      setScrollY(0)
      act(() => window.history.back())
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })
      expect(scrollTo).toHaveBeenLastCalledWith(0, 900)
    })

    it('sin violaciones de accesibilidad con la carta cargada, con y sin mesa', async () => {
      const valid = renderApp('/?mesa=12', undefined, withMenu)
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })
      await expectNoA11yViolations(valid.container)
      valid.unmount()

      const noTable = renderApp('/', undefined, withMenu)
      await screen.findByRole('heading', { level: 2, name: 'Entradas' })
      await expectNoA11yViolations(noTable.container)
    })
  })

  describe('zonas seguras y accesibilidad', () => {
    it('el contenido deja lugar para la barra fija y respeta las zonas seguras', () => {
      renderApp('/')
      const className = screen.getByRole('main').className
      expect(className).toContain('pt-[calc(env(safe-area-inset-top)+5.5rem)]')
      expect(className).toContain('env(safe-area-inset-bottom)')
      expect(className).toContain('env(safe-area-inset-left)')
      expect(className).toContain('env(safe-area-inset-right)')
    })

    it('sin violaciones: carta con mesa, carta sin mesa y "Mis pedidos"', async () => {
      const valid = renderApp('/?mesa=12')
      await screen.findByText('Mesa 12')
      await expectNoA11yViolations(valid.container)
      valid.unmount()

      const missing = renderApp('/')
      await expectNoA11yViolations(missing.container)
      missing.unmount()

      const orders = renderApp('/?mesa=12#/orders')
      await waitFor(() => expect(screen.getByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument())
      await expectNoA11yViolations(orders.container)
    })
  })

  // T8: la barra del pedido reemplaza a la línea provisoria de T7, y enviar lleva a "Mis pedidos".
  describe('pedido en curso y envío (T8: RF21, RF23, RF25, RF26)', () => {
    const withSalad = async () => ({ categories: fixtureMenu.categories, dishes: [salad] })
    const barButton = () => screen.queryByRole('button', { name: /Ver pedido/ })
    const sentOrder = () => makeOrder({ id: 'order-9', code: 'K7F2', tableId: 12, totalCents: 500000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

    async function addSalads(quantity: number) {
      await userEvent.click(await screen.findByRole('button', { name: 'salad' }))
      const dialog = await screen.findByRole('dialog')
      for (let i = 1; i < quantity; i++) {
        await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      }
      await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    async function sendOrder(view: ReturnType<typeof renderApp>) {
      const orders = view.services.orderService as FakeOrderService
      orders.createOrder.mockResolvedValue(sentOrder())
      await addSalads(1)
      await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
      await userEvent.click(await screen.findByRole('button', { name: /^Enviar pedido/ }))
      return orders
    }

    beforeEach(() => {
      window.sessionStorage.clear()
      window.history.replaceState(null, '', '/')
    })

    it('sin nada en el pedido no hay barra', async () => {
      renderApp('/?mesa=12', undefined, withSalad, true)
      await screen.findByRole('button', { name: 'salad' })
      expect(barButton()).not.toBeInTheDocument()
    })

    it('tras agregar muestra la barra con las unidades y el total, y se actualiza al agregar más; ya no hay línea provisoria', async () => {
      const { container } = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(1)
      expect(await screen.findByRole('button', { name: /Ver pedido.*1 unidad(?!es).*\$\s5\.000/ })).toBeInTheDocument()

      await addSalads(2)
      expect(barButton()).toHaveAccessibleName(/3 unidades.*\$\s15\.000/)
      expect(container.querySelector('[data-provisional]')).not.toBeInTheDocument()
      expect(screen.queryByText(/Pedido en curso/)).not.toBeInTheDocument()
    })

    it('al recargar (volver a montar la app) la barra sigue con el pedido', async () => {
      const first = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(2)
      first.unmount()

      renderApp('/?mesa=12', undefined, withSalad, true)
      expect(await screen.findByRole('button', { name: /Ver pedido.*2 unidades/ })).toBeInTheDocument()
    })

    it('otra mesa no ve el pedido de la mesa 12', async () => {
      const first = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(1)
      first.unmount()

      renderApp('/?mesa=5', undefined, withSalad, true)
      await screen.findByRole('button', { name: 'salad' })
      expect(barButton()).not.toBeInTheDocument()
    })

    it('un envío correcto lleva a "Mis pedidos", vacía el pedido y muestra el código (RF25)', async () => {
      const view = renderApp('/?mesa=12', undefined, withSalad, true)
      await sendOrder(view)

      expect(await screen.findByRole('heading', { name: 'Mis pedidos' })).toBeInTheDocument()
      expect(window.location.hash).toBe('#/orders')
      const card = await screen.findByRole('article')
      expect(within(card).getByText('Pedido enviado')).toBeInTheDocument()
      expect(within(card).getByText('K7F2')).toBeInTheDocument()
      expect(barButton()).not.toBeInTheDocument()
      expect(window.sessionStorage.getItem('restaurante.cart.table-12')).toBeNull()
    })

    it('el registro del dispositivo recuerda el pedido enviado (es lo que sigue "Mis pedidos")', async () => {
      window.localStorage.clear()
      const view = renderApp('/?mesa=12', undefined, withSalad, true)
      await sendOrder(view)
      await screen.findByRole('heading', { name: 'Mis pedidos' })

      const stored = JSON.parse(window.localStorage.getItem('restaurante.myOrders') ?? '[]')
      expect(stored).toEqual([expect.objectContaining({ orderId: 'order-9', tableId: 12 })])
    })

    it('tras enviar, "Pedir algo más" vuelve a la carta (el resumen no deja entradas de historial sueltas)', async () => {
      const view = renderApp('/?mesa=12', undefined, withSalad, true)
      await sendOrder(view)
      await screen.findByRole('heading', { name: 'Mis pedidos' })
      expect(window.history.state).toMatchObject({ from: 'menu' })
      expect(window.history.state).not.toHaveProperty('sheet')

      await userEvent.click(screen.getByRole('button', { name: 'Pedir algo más' }))

      expect(await screen.findByRole('button', { name: 'salad' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Mis pedidos' })).not.toBeInTheDocument()
    })

    it('si al recargar había un envío sin resolver y el pedido ya existe, va directo a "Mis pedidos" (CL28)', async () => {
      window.sessionStorage.setItem(
        'restaurante.cart.table-12',
        JSON.stringify({
          lines: [{ dishId: 'salad', quantity: 1, selection: {}, note: '' }],
          note: '',
          pending: { clientRequestId: 'req-viejo', fingerprint: 'huella', startedAt: '2026-10-11T12:00:00.000Z' },
        }),
      )
      const services = createTestServices(undefined, withSalad)
      ;(services.orderService as FakeOrderService).findByClientRequestId.mockResolvedValue(sentOrder())
      renderWithProviders(<CustomerApp />, { url: '/?mesa=12', services, i18n: true, table: true, cart: true, liveRegion: true, myOrders: true })

      expect(await screen.findByRole('heading', { name: 'Mis pedidos' })).toBeInTheDocument()
      expect(window.location.hash).toBe('#/orders')
    })

    it('si el restaurante responde INVALID_TABLE, la mesa deja de ser válida y el pedido en curso se conserva (CL1)', async () => {
      const view = renderApp('/?mesa=12', undefined, withSalad, true)
      const orders = view.services.orderService as FakeOrderService
      orders.createOrder.mockRejectedValue(new ServiceError('INVALID_TABLE', 'x'))
      await addSalads(2)
      await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
      await userEvent.click(await screen.findByRole('button', { name: /^Enviar pedido/ }))

      await waitFor(() => expect(screen.queryByText('Mesa 12')).not.toBeInTheDocument())
      expect(screen.getAllByText(/escaneá el código QR de tu mesa/).length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: /^Enviar pedido/ })).not.toBeInTheDocument()
      expect(JSON.parse(window.sessionStorage.getItem('restaurante.cart.table-12')!).lines[0].quantity).toBe(2)
      expect(window.location.hash).not.toBe('#/orders')
    })

    it('no tiene violaciones de accesibilidad con la barra visible', async () => {
      const { container } = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(1)
      await screen.findByRole('button', { name: /Ver pedido/ })
      await expectNoA11yViolations(container)
    })
  })

  // T9: seguimiento en tiempo real, aviso en la carta y novedad en la barra.
  describe('seguimiento de pedidos (T9: RF28, RF29, RF42, RF47)', () => {
    const fresh = () => new Date().toISOString()
    const tracked = () => makeOrder({ id: 'o-77', code: 'K7F2', tableId: 12, createdAt: fresh(), updatedAt: fresh() })
    const changed = (order: Order, status: Order['status'], plusMs = 1000): Order => ({
      ...order,
      status,
      updatedAt: new Date(Date.now() + plusMs).toISOString(),
    })
    const withSalad = async () => ({ categories: fixtureMenu.categories, dishes: [salad] })

    /** Deja un pedido registrado en este dispositivo y en el restaurante, como si ya se hubiera enviado. */
    function renderTracking(url: string) {
      const order = tracked()
      window.localStorage.setItem(
        'restaurante.myOrders',
        JSON.stringify([{ orderId: order.id, tableId: order.tableId, createdAt: order.createdAt }]),
      )
      const services = createTestServices(undefined, withSalad)
      const orders = services.orderService as FakeOrderService
      orders.orders = [order]
      const view = renderWithProviders(<CustomerApp />, {
        url,
        services,
        i18n: true,
        table: true,
        cart: true,
        liveRegion: true,
        myOrders: true,
      })
      return { order, orders, ...view }
    }
    const emitStatus = (orders: FakeOrderService, order: Order, status: Order['status'], plusMs = 1000) =>
      act(() => orders.emit({ type: 'order.status_changed', order: changed(order, status, plusMs), previousStatus: order.status }))

    beforeEach(() => {
      window.sessionStorage.clear()
      window.history.replaceState(null, '', '/')
    })

    it('un cambio de estado en la carta muestra el Toast con "Ver" y deja la novedad en la barra', async () => {
      const { order, orders } = renderTracking('/?mesa=12')
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })

      emitStatus(orders, order, 'preparing')

      expect(await screen.findByText('Pedido K7F2: En preparación')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mis pedidos, 1 activo, hay novedades' })).toBeInTheDocument()
    })

    it('"Ver" lleva a "Mis pedidos", cierra el Toast y limpia la novedad', async () => {
      const { order, orders } = renderTracking('/?mesa=12')
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })
      emitStatus(orders, order, 'accepted')
      await userEvent.click(await screen.findByRole('button', { name: 'Ver' }))

      expect(window.location.hash).toBe('#/orders')
      expect(screen.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mis pedidos, 1 activo' })).toBeInTheDocument()
    })

    it('en "Mis pedidos" un cambio de estado no muestra Toast y actualiza la tarjeta', async () => {
      const { order, orders } = renderTracking('/?mesa=12#/orders')
      await screen.findByRole('article')

      emitStatus(orders, order, 'preparing')

      expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
      expect(within(screen.getByRole('article')).getAllByText('En preparación').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: 'Mis pedidos, 1 activo' })).toBeInTheDocument()
    })

    it('un cambio ocurrido en "Mis pedidos" no reaparece como Toast al volver a la carta', async () => {
      const { order, orders } = renderTracking('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' }))
      emitStatus(orders, order, 'preparing')

      act(() => window.history.back())
      await screen.findByText('Mesa 12')

      expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
    })

    it('un aviso nuevo reemplaza al anterior (uno a la vez)', async () => {
      const { order, orders } = renderTracking('/?mesa=12')
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })
      emitStatus(orders, order, 'accepted')
      await screen.findByText('Pedido K7F2: Confirmado')

      emitStatus(orders, order, 'preparing', 2000)

      expect(await screen.findByText('Pedido K7F2: En preparación')).toBeInTheDocument()
      expect(screen.queryByText('Pedido K7F2: Confirmado')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Ver' })).toHaveLength(1)
    })

    it('cerrar el Toast lo descarta pero deja la novedad en la barra (la cuenta de 4 s se prueba en Toast.test)', async () => {
      const { order, orders } = renderTracking('/?mesa=12')
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })
      emitStatus(orders, order, 'accepted')

      await userEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso' }))

      // (el anuncio de la región viva sigue teniendo el texto: se comprueba por los botones del aviso)
      expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mis pedidos, 1 activo, hay novedades' })).toBeInTheDocument()
    })

    it('"Pedir algo más" vuelve a la carta conservando la mesa y el pedido en curso', async () => {
      renderTracking('/?mesa=12')
      await screen.findByText('Mesa 12') // agregar se habilita cuando la mesa está verificada (RF3)
      await userEvent.click(await screen.findByRole('button', { name: 'salad' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await userEvent.click(await screen.findByRole('button', { name: /Mis pedidos/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'Pedir algo más' }))

      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: /Ver pedido.*1 unidad/ })).toBeInTheDocument()
    })

    it('sin violaciones de accesibilidad con el Toast visible', async () => {
      const { order, orders, container } = renderTracking('/?mesa=12')
      await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })
      emitStatus(orders, order, 'ready')
      await screen.findByText('Pedido K7F2: Listo para servir')
      await expectNoA11yViolations(container)
    })
  })
})
