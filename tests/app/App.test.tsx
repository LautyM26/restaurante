import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { menu as fixtureMenu } from '../fixtures/menu'
import { createTestServices } from '../fixtures/services'
import { renderWithProviders } from '../utils'

// App arma los providers (servicios, idioma, movimiento, región viva y mesa) y lee ?mesa= una sola vez (plan §3).
describe('App: providers y mesa del QR', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('con ?mesa=12 verifica la mesa con el servicio recibido y la muestra', async () => {
    const services = createTestServices()
    renderWithProviders(<App services={services} />, { url: '/?mesa=12' })

    expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
    expect(services.menuService.getTable).toHaveBeenCalledWith(12)
  })

  it('con otra mesa muestra esa mesa', async () => {
    renderWithProviders(<App services={createTestServices()} />, { url: '/?mesa=7' })
    expect(await screen.findByText('Mesa 7')).toBeInTheDocument()
  })

  it('sin ?mesa no consulta al servicio', () => {
    const services = createTestServices()
    renderWithProviders(<App services={services} />, { url: '/' })
    expect(services.menuService.getTable).not.toHaveBeenCalled()
  })

  it('monta una región viva global para los anuncios', () => {
    renderWithProviders(<App services={createTestServices()} />, { url: '/' })
    expect(document.querySelector('[aria-live="polite"][role="status"]')).toBeInTheDocument()
  })

  it('el cambio de idioma llega al aviso de mesa y a la barra a la vez', async () => {
    renderWithProviders(<App services={createTestServices()} />, { url: '/?mesa=12' })
    await screen.findByRole('button', { name: 'Mis pedidos' })
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(await screen.findByText('Table 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My orders' })).toBeInTheDocument()
  })

  it('monta el pedido en curso de la mesa: agregar un plato lo guarda por mesa (T7)', async () => {
    const services = createTestServices(undefined, async () => fixtureMenu)
    renderWithProviders(<App services={services} />, { url: '/?mesa=12' })

    await userEvent.click(await screen.findByRole('button', { name: 'a_first' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const stored = JSON.parse(window.sessionStorage.getItem('restaurante.cart.table-12')!)
    expect(stored.lines).toMatchObject([{ dishId: 'a_first', quantity: 1 }])
    // Con la mesa verificada se anuncia el agregado por la región viva global
    await waitFor(() => expect(document.querySelector('[role="status"][aria-live="polite"]')).toHaveTextContent('Agregado: a_first × 1'))
  })
})
