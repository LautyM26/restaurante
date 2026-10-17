import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '../../../src/domain/types'
import { Hero } from '../../../src/features/hero/Hero'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { createTestServices } from '../../fixtures/services'
import { makeDish, mains, starters } from '../../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const menu: Menu = { categories: [starters, mains], dishes: [makeDish('f1', { featured: true }), makeDish('p1')] }

function renderHero({
  url = '/?mesa=12',
  withMenu = menu,
  intro = false,
  withCarta = true,
}: { url?: string; withMenu?: Menu | null; intro?: boolean; withCarta?: boolean } = {}) {
  return renderWithProviders(
    <main>
      <Hero menu={withMenu} intro={intro} />
      {withCarta && <section id="carta" aria-label="carta de prueba" />}
    </main>,
    { url, services: createTestServices(), i18n: true, table: true },
  )
}

describe('Hero: la portada (RF4)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('muestra "Mesa 12" cuando la mesa está verificada', async () => {
    renderHero()
    expect(await screen.findByText('Mesa 12')).toBeInTheDocument()
  })

  it('sin mesa válida no inventa un número de mesa', async () => {
    renderHero({ url: '/' })
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(/^Mesa \d+$/)).not.toBeInTheDocument()
  })

  it('tiene un titular de nivel 1 en dos líneas y un subtítulo', () => {
    renderHero()
    const title = screen.getByRole('heading', { level: 1, name: 'Pedí desde tu mesa' })
    const lines = title.querySelectorAll('[data-hero-line]')
    expect([...lines].map((l) => l.textContent)).toEqual(['Pedí desde', 'tu mesa'])
    expect(screen.getByText('Elegí tus platos, personalizalos y mandá el pedido directo a la cocina.')).toBeInTheDocument()
  })

  it('cambia de idioma con la app', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderHero()
    expect(screen.getByRole('heading', { level: 1, name: 'Order from your table' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See the menu' })).toBeInTheDocument()
  })

  it('muestra el anillo de platos cuando hay carta, y no cuando no la hay', () => {
    const { unmount } = renderHero()
    expect(screen.getByTestId('dish-ring')).toBeInTheDocument()
    unmount()
    renderHero({ withMenu: null })
    expect(screen.queryByTestId('dish-ring')).not.toBeInTheDocument()
  })

  describe('"Ver la carta"', () => {
    it('desplaza hasta #carta sin cambiar el hash', async () => {
      const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
      renderHero({ url: '/?mesa=12#/orders' })

      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))

      expect(spy).toHaveBeenCalledTimes(1)
      expect((spy.mock.contexts[0] as HTMLElement).id).toBe('carta')
      expect(window.location.hash).toBe('#/orders')
    })

    it('el desplazamiento es suave, y brusco (sin animación) con movimiento reducido', async () => {
      const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
      renderHero()
      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(spy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })

      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) => ({ matches: query.includes('prefers-reduced-motion'), media: query }) as unknown as MediaQueryList,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(spy).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
    })

    it('si la carta todavía no existe en la página no rompe', async () => {
      const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
      renderHero({ withCarta: false })
      await userEvent.click(screen.getByRole('button', { name: 'Ver la carta' }))
      expect(spy).not.toHaveBeenCalled()
    })

    it('se puede activar con el teclado', async () => {
      const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
      renderHero()
      screen.getByRole('button', { name: 'Ver la carta' }).focus()
      await userEvent.keyboard('{Enter}')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  it('la secuencia de entrada no saca nada del árbol de accesibilidad y termina con todo a la vista', async () => {
    renderHero({ intro: true })
    // durante la entrada el titular y el botón siguen siendo localizables por rol (no hay aria-hidden ni hidden)
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: 'Ver la carta' })).toBeEnabled()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeVisible())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver la carta' })).toBeVisible())
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderHero()
    await screen.findByText('Mesa 12')
    await expectNoA11yViolations(container)
  })
})
