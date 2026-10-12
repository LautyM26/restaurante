import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerApp } from '../../src/app/CustomerApp'
import { ServiceError } from '../../src/services/contracts'
import { createTestServices } from '../fixtures/services'
import { menu as fixtureMenu, salad } from '../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

type GetTable = Parameters<typeof createTestServices>[0]
type GetMenu = Parameters<typeof createTestServices>[1]

const NOTICE_ES = 'Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.'

// `liveRegion` solo donde se agrega a la bolsa: suma otro role="status" que otros tests no esperan.
const renderApp = (url: string, getTable?: GetTable, getMenu?: GetMenu, liveRegion = false) => {
  const services = createTestServices(getTable, getMenu)
  return {
    services,
    ...renderWithProviders(<CustomerApp />, { url, services, i18n: true, table: true, cart: true, liveRegion }),
  }
}

const setScrollY = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })

describe('CustomerApp: esqueleto de la app (RF1, RF2, RF3, RF4, RF32, RF41, RF42)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    setScrollY(0)
  })

  describe('la carta provisoria y la mesa', () => {
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
      expect(screen.getByRole('status')).toHaveTextContent('Verificando tu mesa')
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

    it('con #/orders abre la sección provisoria "Mis pedidos" y no muestra la carta', async () => {
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

    it('"Pedir algo más" vuelve a la carta (hace history.back si se vino de ella)', async () => {
      renderApp('/?mesa=12')
      await userEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }))
      const back = vi.spyOn(window.history, 'back')

      await userEvent.click(screen.getByRole('button', { name: 'Pedir algo más' }))

      expect(back).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
    })

    it('"Pedir algo más" tras entrar directo a #/orders reemplaza la entrada y muestra la carta', async () => {
      renderApp('/?mesa=12#/orders')
      const back = vi.spyOn(window.history, 'back')

      await userEvent.click(screen.getByRole('button', { name: 'Pedir algo más' }))

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

  // T7: hasta que T8 traiga la barra del pedido, una línea provisoria muestra el pedido en curso.
  describe('pedido en curso provisorio (T7: RF23)', () => {
    const withSalad = async () => ({ categories: fixtureMenu.categories, dishes: [salad] })

    async function addSalads(quantity: number) {
      await userEvent.click(await screen.findByRole('button', { name: 'salad' }))
      const dialog = await screen.findByRole('dialog')
      for (let i = 1; i < quantity; i++) {
        await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      }
      await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    beforeEach(() => window.sessionStorage.clear())

    it('sin nada en el pedido no se muestra', async () => {
      renderApp('/?mesa=12', undefined, withSalad, true)
      await screen.findByRole('button', { name: 'salad' })
      expect(screen.queryByText(/Pedido en curso/)).not.toBeInTheDocument()
    })

    it('tras agregar muestra las unidades y el total, y se actualiza al agregar más', async () => {
      renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(1)
      expect(await screen.findByText(/Pedido en curso/)).toHaveTextContent(/: 1 unidad ·/)

      await addSalads(2)
      expect(screen.getByText(/Pedido en curso/)).toHaveTextContent(/3 unidades/)
      expect(screen.getByText(/Pedido en curso/)).toHaveTextContent(/\$\s15\.000/)
    })

    it('al recargar (volver a montar la app) el pedido en curso sigue', async () => {
      const first = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(2)
      first.unmount()

      renderApp('/?mesa=12', undefined, withSalad, true)
      expect(await screen.findByText(/Pedido en curso/)).toHaveTextContent(/2 unidades/)
    })

    it('otra mesa no ve el pedido de la mesa 12', async () => {
      const first = renderApp('/?mesa=12', undefined, withSalad, true)
      await addSalads(1)
      first.unmount()

      renderApp('/?mesa=5', undefined, withSalad, true)
      await screen.findByRole('button', { name: 'salad' })
      expect(screen.queryByText(/Pedido en curso/)).not.toBeInTheDocument()
    })
  })
})
