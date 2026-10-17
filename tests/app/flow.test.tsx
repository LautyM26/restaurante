// Flujo completo de punta a punta con la aplicación real y el servicio simulado (sin servicios falsos):
// QR de la mesa 12 -> ficha -> opciones -> agregar -> enviar -> "Mis pedidos" -> el restaurante avanza el
// pedido en tiempo real -> otra mesa (P3) sigue mostrando el pedido de la mesa 12 con su número.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { buildMockServices } from '../../src/services'
import { createLocalStorage } from '../../src/services/storage'
import { createFakeChannelHub } from '../fixtures/fakeChannel'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

function newServices() {
  return buildMockServices({ latencyMs: 0, autoAdvance: false }, { storage: createLocalStorage(), channelFactory: createFakeChannelHub().factory })
}

async function sendABurger() {
  await screen.findByText('Mesa 12') // agregar se habilita con la mesa verificada
  await userEvent.click(await screen.findByRole('button', { name: /Hamburguesa Fogón/ }))
  const sheet = await screen.findByRole('dialog')
  await userEvent.click(within(sheet).getByRole('radio', { name: /Jugoso/ }))
  await userEvent.click(within(sheet).getByRole('button', { name: /^Agregar/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
  await userEvent.click(await screen.findByRole('button', { name: /^Enviar pedido/ }))
  return screen.findByRole('article')
}

describe('flujo completo del cliente (T9)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('manda un pedido desde la mesa 12, lo ve avanzar en vivo y desde la mesa 5 sigue viéndolo con su mesa', async () => {
    const services = newServices()
    const first = renderWithProviders(<App services={services} />, { url: '/?mesa=12' })

    const card = await sendABurger()
    expect(window.location.hash).toBe('#/orders')
    expect(within(card).getByText('Pedido enviado')).toBeInTheDocument()
    expect(within(card).getByText('Mesa 12')).toBeInTheDocument()
    expect(within(card).getAllByText('Enviado').length).toBeGreaterThan(0)
    await expectNoA11yViolations(first.container)

    // El restaurante (la Spec 002, aquí el servicio simulado) avanza el pedido: aparece sin recargar.
    const [order] = await services.orderService.listOrders({})
    await act(async () => {
      await services.orderService.updateOrderStatus(order.id, 'accepted', 'pending')
      await services.orderService.updateOrderStatus(order.id, 'preparing', 'accepted')
    })
    await waitFor(() => expect(within(screen.getByRole('article')).getAllByText('En preparación').length).toBeGreaterThan(0))
    expect(within(screen.getByRole('article')).getByRole('listitem', { current: 'step' })).toHaveTextContent('En preparación')

    // Escanea el QR de otra mesa: el pedido de la mesa 12 sigue ahí, con su número (P3).
    first.unmount()
    renderWithProviders(<App services={services} />, { url: '/?mesa=5#/orders' })
    const again = await screen.findByRole('article')
    expect(within(again).getByText('Mesa 12')).toBeInTheDocument()
    expect(within(again).getByText(order.code)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Mis pedidos, 1 activo' })).toBeInTheDocument()
  })

  it('con la carta abierta, el avance del pedido muestra el aviso y la novedad en la barra', async () => {
    const services = newServices()
    const view = renderWithProviders(<App services={services} />, { url: '/?mesa=12' })
    await sendABurger()
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir algo más' }))
    await screen.findByText('Mesa 12')

    const [order] = await services.orderService.listOrders({})
    await act(async () => {
      await services.orderService.updateOrderStatus(order.id, 'accepted', 'pending')
    })

    expect(await screen.findByRole('button', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mis pedidos, 1 activo, hay novedades' })).toBeInTheDocument()
    await expectNoA11yViolations(view.container)
  })
})
