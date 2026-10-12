import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RESTAURANT } from '../../../src/config'
import { TopBar } from '../../../src/features/layout/TopBar'
import { ServiceError } from '../../../src/services/contracts'
import { createTestServices } from '../../fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

type GetTable = Parameters<typeof createTestServices>[0]

const renderBar = (url: string, { getTable, ordersOpen }: { getTable?: GetTable; ordersOpen?: boolean } = {}) => {
  const onOpenOrders = vi.fn()
  const services = createTestServices(getTable)
  const view = renderWithProviders(<TopBar onOpenOrders={onOpenOrders} ordersOpen={ordersOpen} />, {
    url,
    services,
    i18n: true,
    table: true,
  })
  return { onOpenOrders, services, ...view }
}

describe('TopBar (RF4, RF42)', () => {
  beforeEach(() => window.localStorage.clear())

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
