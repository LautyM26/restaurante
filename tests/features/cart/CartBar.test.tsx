import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CART_HIGHLIGHT_MS, TOAST_MS } from '../../../src/config'
import { CartBar } from '../../../src/features/cart/CartBar'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { expectNoA11yViolations } from '../../utils'
import { addDish, cart, cartMenu, renderCartUi, withMotion } from './helpers'

const bar = () => screen.queryByRole('button', { name: /Ver pedido/ })

describe('CartBar: barra fija del pedido en curso (RF21, RF19; plan §9.5, §10.2)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate') // jsdom no tiene WAAPI: lo instalan los tests que lo espían
  })

  it('está oculta mientras el pedido no tiene platos', () => {
    renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    expect(bar()).not.toBeInTheDocument()
  })

  it('con platos muestra "Ver pedido", las unidades y el total, y su nombre accesible los incluye', async () => {
    renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    addDish('salad', 3)

    const button = await screen.findByRole('button', { name: /Ver pedido/ })
    expect(button).toHaveAccessibleName(/Ver pedido.*3 unidades.*\$\s15\.000/)
    expect(button).toHaveTextContent(/\$\s15\.000/)
  })

  it('usa el singular con una sola unidad y suma todas las líneas', async () => {
    renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    addDish('salad', 1)
    expect(await screen.findByRole('button', { name: /1 unidad(?!es)/ })).toBeInTheDocument()

    addDish('burger', 2, { cooking: ['rare'] })
    await waitFor(() => expect(bar()).toHaveAccessibleName(/3 unidades.*\$\s29\.000/))
  })

  it('el total sigue al pedido: al cambiar una cantidad se recalcula al instante', async () => {
    renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    addDish('salad', 2)
    await screen.findByRole('button', { name: /\$\s10\.000/ })

    act(() => cart.setQuantity(cart.lines[0].key, 5))
    await waitFor(() => expect(bar()).toHaveAccessibleName(/5 unidades.*\$\s25\.000/))
  })

  it('sin la carta cargada muestra las unidades y no inventa un total', async () => {
    renderCartUi(<CartBar menu={null} onOpen={() => {}} />)
    addDish('salad', 2)

    const button = await screen.findByRole('button', { name: /Ver pedido/ })
    expect(button).toHaveAccessibleName(/2 unidades/)
    expect(button).not.toHaveTextContent('$')
  })

  it('tocarla abre el resumen', async () => {
    const onOpen = vi.fn()
    renderCartUi(<CartBar menu={cartMenu} onOpen={onOpen} />)
    addDish('salad')

    await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('al recargar con un pedido guardado aparece sin ping ni aviso (no se agregó nada ahora)', async () => {
    window.sessionStorage.setItem(
      'restaurante.cart.table-12',
      JSON.stringify({ lines: [{ dishId: 'salad', quantity: 2, selection: {}, note: '' }], note: '' }),
    )
    const animate = vi.fn()
    HTMLElement.prototype.animate = animate
    renderCartUi(withMotion(<CartBar menu={cartMenu} onOpen={() => {}} />))

    expect(await screen.findByRole('button', { name: /2 unidades/ })).toBeInTheDocument()
    expect(animate).not.toHaveBeenCalled()
  })

  it('en inglés dice "View order" y "items"', async () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    addDish('salad', 2)

    expect(await screen.findByRole('button', { name: /View order.*2 items/ })).toBeInTheDocument()
  })

  describe('confirmación visible del agregado (RF19, CL22)', () => {
    it('con movimiento: un ping único en cada agregado (escala y opacidad)', async () => {
      const animate = vi.fn()
      HTMLElement.prototype.animate = animate
      renderCartUi(withMotion(<CartBar menu={cartMenu} onOpen={() => {}} />))

      addDish('salad')
      await screen.findByRole('button', { name: /Ver pedido/ })
      await waitFor(() => expect(animate).toHaveBeenCalledTimes(1))
      const [keyframes, options] = animate.mock.calls[0]
      expect(keyframes[0]).toMatchObject({ opacity: 0.6 })
      expect(keyframes[1]).toMatchObject({ opacity: 0 })
      expect(options).toMatchObject({ duration: 500 })

      addDish('salad')
      await waitFor(() => expect(animate).toHaveBeenCalledTimes(2))
    })

    it('un cambio de cantidad que no es un agregado no dispara el ping', async () => {
      const animate = vi.fn()
      HTMLElement.prototype.animate = animate
      renderCartUi(withMotion(<CartBar menu={cartMenu} onOpen={() => {}} />))
      addDish('salad')
      await waitFor(() => expect(animate).toHaveBeenCalledTimes(1))

      act(() => cart.setQuantity(cart.lines[0].key, 4))
      expect(animate).toHaveBeenCalledTimes(1)
    })

    it('con movimiento reducido no hay ping: el borde se resalta por opacidad y se apaga a los 1,5 s', async () => {
      vi.useFakeTimers()
      const animate = vi.fn()
      HTMLElement.prototype.animate = animate
      renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />) // renderWithProviders ya usa movimiento reducido
      await act(async () => vi.advanceTimersByTimeAsync(0))

      addDish('salad')
      const button = screen.getByRole('button', { name: /Ver pedido/ })
      const frame = button.parentElement!
      expect(frame).toHaveAttribute('data-highlight', 'true')
      expect(animate).not.toHaveBeenCalled()

      await act(async () => vi.advanceTimersByTimeAsync(CART_HIGHLIGHT_MS))
      expect(frame).toHaveAttribute('data-highlight', 'false')
    })
  })

  describe('aviso "Máximo 20 por plato" visible (RF19, P6)', () => {
    it('aparece cuando el agregado se recortó y desaparece solo a los 4 s', async () => {
      vi.useFakeTimers()
      renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
      await act(async () => vi.advanceTimersByTimeAsync(0))

      addDish('salad', 15)
      expect(screen.queryByText('Máximo 20 por plato')).not.toBeInTheDocument()

      addDish('salad', 10)
      expect(screen.getByText('Máximo 20 por plato')).toBeInTheDocument()

      await act(async () => vi.advanceTimersByTimeAsync(TOAST_MS - 1))
      expect(screen.getByText('Máximo 20 por plato')).toBeInTheDocument()
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(screen.queryByText('Máximo 20 por plato')).not.toBeInTheDocument()
    })

    it('un agregado normal después lo oculta de inmediato y no queda duplicado en los anuncios', async () => {
      renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
      addDish('salad', 20)
      addDish('salad', 1)
      expect(await screen.findByText('Máximo 20 por plato')).toHaveAttribute('aria-hidden', 'true')

      addDish('burger', 1, { cooking: ['rare'] })
      await waitFor(() => expect(screen.queryByText('Máximo 20 por plato')).not.toBeInTheDocument())
    })
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderCartUi(<CartBar menu={cartMenu} onOpen={() => {}} />)
    addDish('salad', 2)
    await screen.findByRole('button', { name: /Ver pedido/ })
    await expectNoA11yViolations(container)
  })
})
