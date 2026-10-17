import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '../../../src/domain/types'
import { DishRing } from '../../../src/features/hero/DishRing'
import { RING_PHONE, RING_WIDE, ringCardState } from '../../../src/features/hero/ringMath'
import { makeDish, mains, starters } from '../../fixtures/menu'
import { expectNoA11yViolations } from '../../utils'

const menuWith = (...dishes: ReturnType<typeof makeDish>[]): Menu => ({ categories: [starters, mains], dishes })
const featured = menuWith(
  makeDish('plain'),
  makeDish('f1', { featured: true }),
  makeDish('f2', { featured: true, categoryId: 'starters' }),
  makeDish('f3', { featured: true, available: false }),
)

const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-ring-card]')]
const dishIds = (container: HTMLElement) => new Set(cards(container).map((c) => c.dataset.dishId))

/** matchMedia que responde "sí" solo a las consultas que contengan alguno de los textos dados. */
const stubMedia = (...matching: string[]) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: matching.some((m) => query.includes(m)),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )

/** rAF manual: los cuadros se disparan a mano, con la hora que se quiera. */
function stubFrames() {
  let queue: { id: number; cb: FrameRequestCallback }[] = []
  let next = 1
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    queue.push({ id: next, cb })
    return next++
  })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    queue = queue.filter((f) => f.id !== id)
  })
  return {
    raf,
    cancel,
    pending: () => queue.length,
    flush(time: number) {
      const run = queue
      queue = []
      run.forEach((f) => f.cb(time))
    },
  }
}

describe('DishRing: el anillo de platos (RF4; plan §9.5)', () => {
  beforeEach(() => stubFrames())
  afterEach(() => vi.restoreAllMocks())

  describe('qué muestra', () => {
    it('es decorativo: aria-hidden y sin atrapar toques', async () => {
      const { container } = render(<DishRing menu={featured} />)
      const ring = screen.getByTestId('dish-ring')
      expect(ring).toHaveAttribute('aria-hidden', 'true')
      expect(ring.className).toContain('pointer-events-none')
      await expectNoA11yViolations(container)
    })

    it('solo muestra destacados pedibles: ni los comunes ni el destacado agotado', () => {
      const { container } = render(<DishRing menu={featured} />)
      expect(dishIds(container)).toEqual(new Set(['f1', 'f2']))
    })

    it('sin destacados recurre a los primeros pedibles', () => {
      const menu = menuWith(makeDish('gone', { available: false }), makeDish('a'), makeDish('b'))
      const { container } = render(<DishRing menu={menu} />)
      expect(dishIds(container)).toEqual(new Set(['a', 'b']))
    })

    it('no se muestra sin platos pedibles', () => {
      render(<DishRing menu={menuWith(makeDish('gone', { available: false }))} />)
      expect(screen.queryByTestId('dish-ring')).not.toBeInTheDocument()
    })

    it('no se muestra mientras no hay carta', () => {
      render(<DishRing menu={null} />)
      expect(screen.queryByTestId('dish-ring')).not.toBeInTheDocument()
    })

    it('no escribe textos de los platos: no duplica los nombres que lee el lector de pantalla', () => {
      render(<DishRing menu={featured} />)
      expect(screen.getByTestId('dish-ring')).toHaveTextContent('')
    })

    it('en celular dibuja las 16 posiciones, ciclando los platos', () => {
      const { container } = render(<DishRing menu={featured} />)
      expect(cards(container)).toHaveLength(RING_PHONE.count)
    })

    it('desde 768 px dibuja las 20 posiciones del anillo grande', () => {
      stubMedia('(min-width: 768px)')
      const { container } = render(<DishRing menu={featured} />)
      expect(cards(container)).toHaveLength(RING_WIDE.count)
    })
  })

  describe('pintado y giro', () => {
    const visibleCards = (container: HTMLElement) => cards(container).filter((c) => c.style.visibility !== 'hidden')

    it('pinta de entrada la posición inicial: 5 cartas visibles y la del frente sin desplazamiento', () => {
      const { container } = render(<DishRing menu={featured} />)
      expect(visibleCards(container)).toHaveLength(5)
      expect(cards(container)[0].style.transform).toBe(ringCardState(0, 0, RING_PHONE).transform)
    })

    it('gira: tras un segundo de cuadros cada carta está donde dice ringCardState con 3° más', () => {
      const frames = stubFrames()
      const { container } = render(<DishRing menu={featured} />)
      // 11 cuadros separados 100 ms = 10 saltos = 1 s a 3°/s
      for (let i = 0; i <= 10; i++) frames.flush(1000 + i * 100)
      const list = cards(container)
      for (const index of [0, 1, 7]) {
        expect(list[index].style.transform).toBe(ringCardState(index, 3, RING_PHONE).transform)
      }
    })

    it('la sombra de cada carta sigue a su posición (opacity de la capa interior)', () => {
      const frames = stubFrames()
      const { container } = render(<DishRing menu={featured} />)
      for (let i = 0; i <= 10; i++) frames.flush(1000 + i * 100)
      const shade = cards(container)[1].querySelector<HTMLElement>('[data-ring-shade]')!
      expect(Number(shade.style.opacity)).toBeCloseTo(ringCardState(1, 3, RING_PHONE).shade, 3)
    })

    it('con movimiento reducido la fase no avanza ni se programan cuadros', () => {
      stubMedia('prefers-reduced-motion')
      const frames = stubFrames()
      const { container } = render(<DishRing menu={featured} />)
      const before = cards(container).map((c) => c.style.transform)
      for (let i = 0; i <= 10; i++) frames.flush(1000 + i * 100)
      expect(cards(container).map((c) => c.style.transform)).toEqual(before)
      expect(frames.raf).not.toHaveBeenCalled()
      // y sigue mostrando el anillo quieto
      expect(visibleCards(container)).toHaveLength(5)
    })

    it('al desmontarse cancela el cuadro pendiente', () => {
      const frames = stubFrames()
      const { unmount } = render(<DishRing menu={featured} />)
      expect(frames.pending()).toBe(1)
      unmount()
      expect(frames.pending()).toBe(0)
      expect(frames.cancel).toHaveBeenCalled()
    })

    it('se detiene fuera de pantalla: sin cuadros pendientes si el anillo salió de la vista, y retoma al volver', () => {
      type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void
      let notify: Callback = () => {}
      class FakeObserver {
        constructor(cb: Callback) {
          notify = cb
        }
        observe() {}
        disconnect() {}
      }
      vi.stubGlobal('IntersectionObserver', FakeObserver)
      const frames = stubFrames()
      render(<DishRing menu={featured} />)
      expect(frames.pending()).toBe(1)
      act(() => notify([{ isIntersecting: false }]))
      expect(frames.pending()).toBe(0)
      act(() => notify([{ isIntersecting: true }]))
      expect(frames.pending()).toBe(1)
      vi.unstubAllGlobals()
    })
  })
})
