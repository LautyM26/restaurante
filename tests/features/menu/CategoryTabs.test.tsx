import { useState } from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '../../../src/domain/types'
import { CategoryTabs } from '../../../src/features/menu/CategoryTabs'
import { categorySectionId } from '../../../src/features/menu/MenuSection'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

// IntersectionObserver controlable: jsdom no calcula geometría, así que el test decide qué secciones "se ven".
class FakeObserver {
  static instances: FakeObserver[] = []
  targets = new Set<Element>()
  disconnected = false
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  // Campos declarados a mano: erasableSyntaxOnly no admite propiedades de parámetro.
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    FakeObserver.instances.push(this)
  }
  observe(element: Element) {
    this.targets.add(element)
  }
  unobserve(element: Element) {
    this.targets.delete(element)
  }
  disconnect() {
    this.disconnected = true
    this.targets.clear()
  }
  takeRecords() {
    return []
  }
  /** Informa qué secciones (por id de categoría) entran o salen de la franja observada. */
  report(changes: Record<string, boolean>) {
    const entries = Object.entries(changes).map(
      ([categoryId, isIntersecting]) =>
        ({ target: document.getElementById(categorySectionId(categoryId)), isIntersecting }) as unknown as IntersectionObserverEntry,
    )
    this.callback(entries, this as unknown as IntersectionObserver)
  }
}
const liveObserver = () => FakeObserver.instances.filter((o) => !o.disconnected).at(-1)!
const report = (changes: Record<string, boolean>) => act(() => liveObserver().report(changes))

const starters: Category = { id: 'starters', name: { es: 'Entradas', en: 'Starters' }, order: 1, visual: 'starter' }
const mains: Category = { id: 'mains', name: { es: 'Principales', en: 'Mains' }, order: 2, visual: 'main' }
const desserts: Category = { id: 'desserts', name: { es: 'Postres' }, order: 3, visual: 'dessert' }
const CATEGORIES = [starters, mains, desserts]

/** Las pestañas junto con las secciones a las que apuntan (en la app las dibuja MenuSection). */
function Harness({ categories = CATEGORIES }: { categories?: Category[] }) {
  return (
    <>
      <CategoryTabs categories={categories} />
      {categories.map((category) => (
        <section key={category.id} id={categorySectionId(category.id)} aria-label={`sección ${category.id}`} />
      ))}
    </>
  )
}

/** Igual que Harness, con un botón que quita la última categoría (como cuando un refresco cambia la carta). */
function Shrinking() {
  const [shrunk, setShrunk] = useState(false)
  return (
    <>
      <button onClick={() => setShrunk(true)}>quitar postres</button>
      <Harness categories={shrunk ? [starters, mains] : CATEGORIES} />
    </>
  )
}

const renderTabs = (categories?: Category[]) => renderWithProviders(<Harness categories={categories} />, { i18n: true })
const tab = (name: string) => screen.getByRole('button', { name })
const section = (id: string) => document.getElementById(categorySectionId(id))!

describe('CategoryTabs: navegación de categorías (RF11, RF12; plan §9.5)', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.localStorage.clear()
    FakeObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('estructura y accesibilidad', () => {
    it('es una navegación con nombre y un botón por categoría, en orden y en español', () => {
      renderTabs()
      const nav = screen.getByRole('navigation', { name: 'Categorías de la carta' })
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entradas', 'Principales', 'Postres'])
    })

    it('en inglés traduce los nombres y usa el español si falta la traducción', () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderTabs()
      expect(screen.getByRole('navigation', { name: 'Menu categories' })).toBeInTheDocument()
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Starters', 'Mains', 'Postres'])
    })

    it('cada pestaña mide al menos 44 px de alto y la lista se desplaza en horizontal con snap', () => {
      renderTabs()
      for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('min-h-11')
      const list = screen.getByRole('list')
      expect(list).toHaveClass('overflow-x-auto', 'snap-x')
    })

    it('la barra queda pegada bajo la barra superior, en su capa', () => {
      const { container } = renderTabs()
      const bar = container.querySelector('[data-category-bar]')!
      expect(bar.className).toContain('sticky')
      expect(bar.className).toContain('env(safe-area-inset-top)')
      expect(bar.className).toContain('z-(--z-tabs)')
    })

    it('no usa vidrio con desenfoque: respeta el máximo de dos superficies con backdrop-filter (plan §10.4)', () => {
      const { container } = renderTabs()
      expect(container.querySelector('[data-category-bar]')!.innerHTML).not.toContain('glass')
      expect(container.querySelector('[data-category-bar]')!.innerHTML).not.toContain('backdrop')
    })

    it('sin violaciones de accesibilidad', async () => {
      const { container } = renderTabs()
      await expectNoA11yViolations(container)
    })
  })

  describe('categoría activa (RF12)', () => {
    it('al empezar marca la primera con aria-current', () => {
      renderTabs()
      expect(tab('Entradas')).toHaveAttribute('aria-current', 'true')
      expect(tab('Principales')).not.toHaveAttribute('aria-current')
      expect(tab('Postres')).not.toHaveAttribute('aria-current')
    })

    it('observa cada sección con una franja que empieza bajo la barra y llega hasta la mitad de la pantalla', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 54 } as DOMRect)
      renderTabs()
      const observer = liveObserver()

      expect([...observer.targets]).toEqual(CATEGORIES.map((c) => section(c.id)))
      // 54 px de la barra + 8 px de aire; abajo, el 50 % de la pantalla.
      expect(observer.options?.rootMargin).toBe('-62px 0px -50% 0px')
    })

    it('una intersección simulada cambia la categoría resaltada', () => {
      renderTabs()
      report({ starters: true })
      expect(tab('Entradas')).toHaveAttribute('aria-current', 'true')

      report({ starters: false, mains: true })
      expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
      expect(tab('Entradas')).not.toHaveAttribute('aria-current')

      report({ mains: false, desserts: true })
      expect(tab('Postres')).toHaveAttribute('aria-current', 'true')
    })

    it('si dos secciones están en la franja gana la de más abajo (la que acaba de entrar)', () => {
      renderTabs()
      report({ starters: true, mains: true })
      expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
    })

    it('si ninguna está en la franja conserva la última resaltada', () => {
      renderTabs()
      report({ mains: true })
      report({ mains: false })
      expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
    })

    it('el indicador (layoutId) viaja a la pestaña activa: solo una lo tiene', () => {
      const { container } = renderTabs()
      expect(container.querySelectorAll('[data-indicator]')).toHaveLength(1)
      expect(tab('Entradas').querySelector('[data-indicator]')).toBeInTheDocument()

      report({ mains: true })
      expect(container.querySelectorAll('[data-indicator]')).toHaveLength(1)
      expect(tab('Principales').querySelector('[data-indicator]')).toBeInTheDocument()
      expect(tab('Entradas').querySelector('[data-indicator]')).not.toBeInTheDocument()
    })

    it('centra la pestaña activa en la lista horizontal', () => {
      renderTabs()
      const list = screen.getByRole('list')
      const scrollTo = vi.fn()
      list.scrollTo = scrollTo as unknown as typeof list.scrollTo
      Object.defineProperty(list, 'clientWidth', { value: 200, configurable: true })
      const target = tab('Postres')
      Object.defineProperty(target.parentElement!, 'offsetLeft', { value: 300, configurable: true })
      Object.defineProperty(target.parentElement!, 'offsetWidth', { value: 100, configurable: true })

      report({ desserts: true })

      // 300 - (200 - 100) / 2
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 250 }))
    })

    it('al cambiar las categorías (refresco de la carta) vuelve a observar las nuevas y suelta el observador viejo', () => {
      renderWithProviders(<Shrinking />, { i18n: true })
      const first = liveObserver()

      act(() => screen.getByRole('button', { name: 'quitar postres' }).click())
      expect(first.disconnected).toBe(true)
      expect([...liveObserver().targets]).toEqual([section('starters'), section('mains')])
    })

    it('si la categoría activa desaparece de la carta, marca la primera', () => {
      renderWithProviders(<Shrinking />, { i18n: true })
      report({ desserts: true })
      expect(tab('Postres')).toHaveAttribute('aria-current', 'true')

      act(() => screen.getByRole('button', { name: 'quitar postres' }).click())
      expect(tab('Entradas')).toHaveAttribute('aria-current', 'true')
    })

    it('al desmontar suelta el observador', () => {
      const { unmount } = renderTabs()
      const observer = liveObserver()
      unmount()
      expect(observer.disconnected).toBe(true)
    })
  })

  describe('tocar una categoría (RF11)', () => {
    it('desplaza la vista hasta el inicio de esa sección con scrollIntoView', async () => {
      renderTabs()
      await userEvent.click(tab('Principales'))

      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.contexts[0]).toBe(section('mains'))
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    })

    it('con movimiento reducido el desplazamiento es directo', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
      )
      renderTabs()
      await userEvent.click(tab('Postres'))
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    })

    it('resalta la categoría tocada de inmediato, sin esperar a que termine el desplazamiento', async () => {
      renderTabs()
      await userEvent.click(tab('Postres'))
      expect(tab('Postres')).toHaveAttribute('aria-current', 'true')
      expect(tab('Entradas')).not.toHaveAttribute('aria-current')
    })

    it('tocar una categoría cuya sección no existe no rompe', async () => {
      renderWithProviders(<CategoryTabs categories={CATEGORIES} />, { i18n: true })
      await userEvent.click(tab('Principales'))
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
    })

    it('se puede tocar con el teclado', async () => {
      renderTabs()
      await userEvent.tab()
      await userEvent.tab()
      expect(tab('Principales')).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      expect(scrollIntoView.mock.contexts[0]).toBe(section('mains'))
    })

    describe('mientras dura el desplazamiento no parpadean las categorías del medio', () => {
      it('ignora las intersecciones hasta que termina el desplazamiento (scrollend)', async () => {
        renderTabs()
        await userEvent.click(tab('Postres'))

        report({ starters: false, mains: true }) // el recorrido pasa por "Principales"
        expect(tab('Postres')).toHaveAttribute('aria-current', 'true')

        // El desplazamiento termina con "Postres" en la franja.
        report({ mains: false, desserts: true })
        act(() => {
          window.dispatchEvent(new Event('scrollend'))
        })
        expect(tab('Postres')).toHaveAttribute('aria-current', 'true')
      })

      it('al terminar aplica lo que realmente se ve si no es la categoría tocada', async () => {
        renderTabs()
        await userEvent.click(tab('Postres'))
        report({ mains: true })
        // Se terminó de desplazar en otra parte (no al final de la página): manda lo que se ve.
        act(() => {
          window.dispatchEvent(new Event('scrollend'))
        })
        expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
      })

      it('sin scrollend (navegadores viejos) se libera solo al pasar 1 s', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        renderTabs()
        await userEvent.click(tab('Postres'))

        report({ mains: true })
        expect(tab('Postres')).toHaveAttribute('aria-current', 'true')

        act(() => {
          vi.advanceTimersByTime(1000)
        })
        expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
      })

      it('una categoría corta al final de la página no se pierde: si se llegó al fondo, queda la tocada', async () => {
        renderTabs()
        await userEvent.click(tab('Postres'))
        report({ mains: true })
        // La página no pudo bajar más (su sección es corta y nunca llega a la franja).
        Object.defineProperty(window, 'scrollY', { value: 5000 - window.innerHeight, configurable: true })
        act(() => {
          window.dispatchEvent(new Event('scrollend'))
        })
        expect(tab('Postres')).toHaveAttribute('aria-current', 'true')
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
      })

      it('el bloqueo se renueva con cada toque: dos toques seguidos no se pisan', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        renderTabs()
        await userEvent.click(tab('Principales'))
        act(() => {
          vi.advanceTimersByTime(600)
        })
        await userEvent.click(tab('Postres'))
        act(() => {
          vi.advanceTimersByTime(600) // 1200 ms desde el primero, 600 desde el segundo
        })
        report({ mains: true })
        expect(tab('Postres')).toHaveAttribute('aria-current', 'true')
      })
    })
  })

  it('sin IntersectionObserver (navegador muy viejo) las pestañas siguen funcionando', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    renderTabs()
    await userEvent.click(tab('Principales'))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(tab('Principales')).toHaveAttribute('aria-current', 'true')
  })
})
