import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '../../../src/domain/types'
import { LanguageToggle } from '../../../src/features/layout/LanguageToggle'
import { MenuScreen } from '../../../src/features/menu/MenuScreen'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { ServiceError } from '../../../src/services/contracts'
import { useMenu } from '../../../src/state/useMenu'
import { createTestServices } from '../../fixtures/services'
import { makeDish, menu as fixtureMenu, mains, starters } from '../../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

type GetMenu = NonNullable<Parameters<typeof createTestServices>[1]>

/** MenuScreen recibe el estado del hook por props (plan §4): este arnés hace de CustomerApp. */
function Harness() {
  const menu = useMenu()
  return <MenuScreen menu={menu} onSent={() => {}} />
}

function renderMenu(getMenu: GetMenu = async () => fixtureMenu) {
  const services = createTestServices(undefined, getMenu)
  return {
    services,
    ...renderWithProviders(<Harness />, { url: '/?mesa=12', services, i18n: true, table: true, cart: true, liveRegion: true }),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const onlyButtons = () => screen.queryAllByRole('button').map((b) => b.textContent)
const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

describe('MenuScreen: la carta (RF7-RF10, RF13, RF34, RF45)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('es la sección #carta, el ancla de la carta', async () => {
    const { container } = renderMenu()
    await screen.findByRole('navigation')
    expect(container.querySelector('section#carta')).toBeInTheDocument()
  })

  describe('carga (RF8)', () => {
    it('mientras carga muestra marcadores con la forma del contenido y avisa en texto; sin pestañas ni platos', () => {
      const pending = deferred<Menu>()
      const { container } = renderMenu(() => pending.promise)

      const busy = container.querySelector('[aria-busy="true"]')!
      expect(busy).toBeInTheDocument()
      expect(within(busy as HTMLElement).getByText('Cargando la carta')).toBeInTheDocument()
      expect(busy.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(6)
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(onlyButtons()).toEqual(['Ver la carta']) // la portada; ningún plato
    })

    it('al llegar la carta reemplaza los marcadores', async () => {
      const pending = deferred<Menu>()
      const { container } = renderMenu(() => pending.promise)
      await act(async () => pending.resolve(fixtureMenu))

      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('el mensaje de carga sigue al idioma', () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderMenu(() => new Promise(() => {}))
      expect(screen.getByText('Loading the menu')).toBeInTheDocument()
    })
  })

  describe('carta cargada (RF7, RF10)', () => {
    it('muestra las categorías en el orden definido, con sus platos, y oculta la categoría vacía', async () => {
      renderMenu()
      await screen.findByRole('navigation')

      expect(headings()).toEqual(['Entradas', 'Principales'])
      expect(screen.queryByText('Postres')).not.toBeInTheDocument()
    })

    it('los platos de cada categoría salen por su campo order', async () => {
      renderMenu()
      await screen.findByRole('navigation')

      const principales = screen.getByRole('region', { name: 'Principales' })
      const names = within(principales)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-labelledby'))
        .map((id) => document.getElementById(id!)!.textContent)
      // Plato con order 0, 1, 2, 3 y 4 de la categoría "mains" del fixture
      expect(names).toEqual(['a_first', 'burger', 'b_second', 'sold_out', 'trapped'])
    })

    it('descarta el plato de una categoría inexistente (CL36)', async () => {
      renderMenu()
      await screen.findByRole('navigation')
      expect(screen.queryByRole('button', { name: 'orphan' })).not.toBeInTheDocument()
    })

    it('las pestañas de categorías coinciden con las secciones', async () => {
      renderMenu()
      const nav = await screen.findByRole('navigation', { name: 'Categorías de la carta' })
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entradas', 'Principales'])
    })

    it('un plato agotado y uno de grupo obligatorio sin opciones (P4) se ven como "Agotado" y no se pueden abrir', async () => {
      renderMenu()
      await screen.findByRole('navigation')

      for (const name of ['sold_out', 'trapped']) {
        const row = screen.getByRole('button', { name })
        expect(row).toBeDisabled()
        expect(within(row).getByText('Agotado')).toBeInTheDocument()
        await userEvent.click(row)
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('tocar un plato disponible abre su ficha (RF14)', async () => {
      renderMenu()
      await screen.findByRole('navigation')

      await userEvent.click(screen.getByRole('button', { name: 'burger' }))
      expect(await screen.findByRole('dialog', { name: 'burger' })).toBeInTheDocument()
    })

    it('cambiar de idioma traduce títulos, pestañas y platos, con fallback al español', async () => {
      const bilingual: Menu = {
        categories: [
          { ...starters, name: { es: 'Entradas', en: 'Starters' } },
          { ...mains, name: { es: 'Principales' } },
        ],
        dishes: [
          makeDish('a', { categoryId: 'starters', name: { es: 'Provoleta', en: 'Grilled provolone' } }),
          makeDish('b', { categoryId: 'mains', name: { es: 'Bife de chorizo' } }),
        ],
      }
      const services = createTestServices(undefined, async () => bilingual)
      renderWithProviders(
        <>
          <LanguageToggle />
          <Harness />
        </>,
        { services, url: '/?mesa=12', i18n: true, table: true, cart: true, liveRegion: true },
      )
      await screen.findByRole('navigation')
      expect(headings()).toEqual(['Entradas', 'Principales'])

      await userEvent.click(screen.getByRole('radio', { name: 'English' }))

      expect(headings()).toEqual(['Starters', 'Principales'])
      const nav = screen.getByRole('navigation', { name: 'Menu categories' })
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Starters', 'Principales'])
      expect(screen.getByRole('button', { name: 'Grilled provolone' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bife de chorizo' })).toBeInTheDocument()
    })
  })

  describe('error (RF9)', () => {
    it('muestra el problema y "Reintentar", que vuelve a pedir la carta', async () => {
      let calls = 0
      const { services } = renderMenu(async () => {
        if (++calls === 1) throw new ServiceError('SERVER', 'caído')
        return fixtureMenu
      })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('No pudimos cargar la carta.')
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

      await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }))
      expect(await screen.findByRole('navigation')).toBeInTheDocument()
      expect(services.menuService.getMenu).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('sin conexión el mensaje es distinto y explica que la carta se carga sola', async () => {
      renderMenu(async () => {
        throw new ServiceError('NETWORK', 'sin red')
      })
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Estás sin conexión.')
      expect(alert).toHaveTextContent('Cuando vuelva la conexión, la carta se carga sola.')
      expect(alert).not.toHaveTextContent('No pudimos cargar la carta.')
      expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    })

    it('si el reintento vuelve a fallar sigue mostrando el error y se puede probar otra vez', async () => {
      const { services } = renderMenu(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(services.menuService.getMenu).toHaveBeenCalledTimes(2))
      await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(services.menuService.getMenu).toHaveBeenCalledTimes(3))
    })

    it('el botón de reintento es el botón brasa', async () => {
      renderMenu(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveClass('btn-ember')
    })

    it('el mensaje de error sigue al idioma', async () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderMenu(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the menu.")
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  describe('carta vacía (RF10, CL4)', () => {
    it('sin ningún plato explica que la carta no está disponible y sugiere consultar al personal', async () => {
      renderMenu(async () => ({ categories: [starters], dishes: [] }))
      expect(await screen.findByText('La carta no está disponible en este momento. Consultá al personal.')).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(onlyButtons()).toEqual(['Ver la carta'])
    })

    it('una carta con solo platos huérfanos también se considera vacía', async () => {
      renderMenu(async () => ({ categories: [starters], dishes: [makeDish('lost', { categoryId: 'ghost' })] }))
      expect(await screen.findByText(/La carta no está disponible/)).toBeInTheDocument()
    })

    it('el mensaje de carta vacía sigue al idioma', async () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderMenu(async () => ({ categories: [], dishes: [] }))
      expect(await screen.findByText("The menu isn't available right now. Please ask our staff.")).toBeInTheDocument()
    })
  })

  describe('refresco al volver a primer plano (RF45)', () => {
    it('refresca sin saltos: los mismos elementos siguen en el DOM y los cambios aparecen', async () => {
      let calls = 0
      const { services } = renderMenu(async () => {
        calls++
        return calls === 1
          ? fixtureMenu
          : { ...fixtureMenu, dishes: fixtureMenu.dishes.map((d) => (d.id === 'burger' ? { ...d, available: false } : d)) }
      })
      await screen.findByRole('navigation')
      const heading = screen.getByRole('heading', { name: 'Principales' })
      const burgerRow = screen.getByRole('button', { name: 'burger' })
      expect(burgerRow).toBeEnabled()

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => expect(services.menuService.getMenu).toHaveBeenCalledTimes(2))

      await waitFor(() => expect(screen.getByRole('button', { name: 'burger' })).toBeDisabled())
      expect(screen.getByRole('heading', { name: 'Principales' })).toBe(heading)
      expect(screen.getByRole('button', { name: 'burger' })).toBe(burgerRow)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument()
    })

    it('si el refresco falla conserva la carta y no muestra error', async () => {
      let calls = 0
      const { services } = renderMenu(async () => {
        if (++calls === 2) throw new ServiceError('NETWORK', 'sin red')
        return fixtureMenu
      })
      await screen.findByRole('navigation')

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => expect(services.menuService.getMenu).toHaveBeenCalledTimes(2))
      await act(async () => {})

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(headings()).toEqual(['Entradas', 'Principales'])
    })
  })

  describe('portada y panel (RF4, plan §9.5 y §9.6)', () => {
    it('antepone la portada a la carta: titular, mesa y "Ver la carta" antes del panel #carta', async () => {
      const { container } = renderMenu()
      await screen.findByRole('navigation')
      const title = screen.getByRole('heading', { level: 1, name: 'Pedí desde tu mesa' })
      const panel = container.querySelector('section#carta')!
      expect(title.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
      expect(screen.getByTestId('dish-ring')).toBeInTheDocument()
    })

    it('"Ver la carta" lleva al panel #carta sin tocar el hash', async () => {
      const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
      const { container } = renderMenu()
      await screen.findByRole('navigation')
      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(spy.mock.contexts.at(-1)).toBe(container.querySelector('section#carta'))
      expect(window.location.hash).toBe('')
    })

    it('las pestañas de categorías y las secciones viven dentro del panel; la portada, fuera', async () => {
      const { container } = renderMenu()
      const tabs = await screen.findByRole('navigation')
      const panel = container.querySelector('section#carta')!
      expect(panel).toContainElement(tabs)
      expect(panel).not.toContainElement(screen.getByRole('heading', { level: 1 }))
      expect(panel).not.toContainElement(screen.getByRole('button', { name: 'Ver la carta' }))
    })

    it('mientras carga y si falla, la portada se ve igual y sin anillo', async () => {
      const pending = deferred<Menu>()
      const { unmount } = renderMenu(() => pending.promise)
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.queryByTestId('dish-ring')).not.toBeInTheDocument()
      unmount()

      renderMenu(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      await screen.findByRole('alert')
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.queryByTestId('dish-ring')).not.toBeInTheDocument()
    })

    it('sin mesa, el aviso de la mesa va dentro del panel y la portada no muestra "Mesa"', async () => {
      const services = createTestServices(undefined, async () => fixtureMenu)
      const { container } = renderWithProviders(<Harness />, { url: '/', services, i18n: true, table: true, cart: true, liveRegion: true })
      await screen.findByRole('navigation')
      expect(container.querySelector('section#carta')).toContainElement(screen.getByRole('note'))
      expect(screen.queryByText(/^Mesa \d+$/)).not.toBeInTheDocument()
    })
  })

  describe('accesibilidad', () => {
    it('sin violaciones en carga, carta, error y carta vacía', async () => {
      const pending = deferred<Menu>()
      const loading = renderMenu(() => pending.promise)
      await expectNoA11yViolations(loading.container)
      loading.unmount()

      const ready = renderMenu()
      await screen.findByRole('navigation')
      await expectNoA11yViolations(ready.container)
      ready.unmount()

      const failed = renderMenu(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      await screen.findByRole('alert')
      await expectNoA11yViolations(failed.container)
      failed.unmount()

      const empty = renderMenu(async () => ({ categories: [], dishes: [] }))
      await screen.findByText(/La carta no está disponible/)
      await expectNoA11yViolations(empty.container)
    })
  })
})
