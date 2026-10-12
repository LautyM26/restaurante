import { useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '../../src/services/contracts'
import { ServicesProvider, useServices } from '../../src/services/ServicesContext'
import { createFakeOrderService } from '../fixtures/fakeOrderService'
import { makeOrder } from '../fixtures/orders'
import { renderWithProviders } from '../utils'

const menuService: Services['menuService'] = {
  getMenu: async () => ({ categories: [], dishes: [] }),
  getTable: async (id) => ({ id }),
}

/** Pantalla mínima que depende solo de useServices(): escucha eventos y envía un pedido. */
function Probe() {
  const { orderService } = useServices()
  const [seen, setSeen] = useState<string[]>([])
  const [sent, setSent] = useState('')

  useEffect(
    () => orderService.subscribe((e) => setSeen((prev) => [...prev, `${e.type}:${e.order.code}`]), { kind: 'tables', tableIds: [12] }),
    [orderService],
  )

  return (
    <>
      <button
        onClick={async () => {
          const order = await orderService.createOrder({ clientRequestId: 'r1', tableId: 12, items: [], expectedTotalCents: 0 })
          setSent(order.code)
        }}
      >
        Enviar
      </button>
      <p>Enviado: {sent}</p>
      <ul aria-label="Eventos">
        {seen.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </>
  )
}

describe('useServices', () => {
  it('fuera del provider da un error claro', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useServices debe usarse dentro de <ServicesProvider>')
    consoleError.mockRestore()
  })

  it('acepta un fakeOrderService sin transporte y entrega sus llamadas y eventos', async () => {
    const orderService = createFakeOrderService()
    orderService.createOrder.mockResolvedValueOnce(makeOrder({ code: 'K7F2' }))
    renderWithProviders(<Probe />, { services: { menuService, orderService } })

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Enviado: K7F2')).toBeInTheDocument()
    expect(orderService.createOrder).toHaveBeenCalledWith(expect.objectContaining({ clientRequestId: 'r1', tableId: 12 }))

    act(() => orderService.emit({ type: 'order.created', order: makeOrder({ code: 'ABCD', tableId: 12 }) }))
    expect(screen.getByRole('list', { name: 'Eventos' })).toHaveTextContent('order.created:ABCD')
  })

  it('cancela la suscripción al desmontar', () => {
    const orderService = createFakeOrderService()
    const { unmount } = renderWithProviders(<Probe />, { services: { menuService, orderService } })
    expect(orderService.subscriptions.map((s) => s.active)).toEqual([true])

    unmount()

    expect(orderService.subscriptions.map((s) => s.active)).toEqual([false])
  })

  it('entrega a los hijos los mismos servicios que recibió el provider', () => {
    const services: Services = { menuService, orderService: createFakeOrderService() }
    let received: Services | undefined
    function Capture() {
      received = useServices()
      return null
    }
    render(
      <ServicesProvider services={services}>
        <Capture />
      </ServicesProvider>,
    )
    expect(received).toBe(services)
  })
})
