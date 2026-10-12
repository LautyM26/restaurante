import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackToClose } from '../../src/app/useBackToClose'

function Sheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackToClose(open, onClose)
  return null
}

const firePopState = () => window.dispatchEvent(new PopStateEvent('popstate'))
/** El cierre desde la interfaz retrocede en un microtask: se espera a que corra. */
const flush = () => act(async () => {})

describe('useBackToClose: "atrás" cierra la hoja (RF43, CL29)', () => {
  beforeEach(() => {
    window.history.replaceState({ app: 'restaurante' }, '', '/?mesa=12')
  })
  afterEach(() => vi.restoreAllMocks())

  it('abrir empuja una entrada de historial con la misma URL', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<Sheet open={false} onClose={() => {}} />)
    expect(push).not.toHaveBeenCalled()

    rerender(<Sheet open onClose={() => {}} />)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push.mock.calls[0][0]).toMatchObject({ sheet: true })
    expect(window.location.pathname + window.location.search).toBe('/?mesa=12')
    expect(window.history.state).toMatchObject({ sheet: true })
  })

  it('abierta desde el primer render también empuja una sola entrada', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<Sheet open onClose={() => {}} />)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('un popstate con la hoja abierta la cierra y no retrocede otra vez', async () => {
    const back = vi.spyOn(window.history, 'back')
    const onClose = vi.fn()
    const { rerender } = render(<Sheet open onClose={onClose} />)

    act(() => firePopState())
    expect(onClose).toHaveBeenCalledTimes(1)

    // El estado de React ya cerró la hoja: la entrada del historial ya no está, no hay que retroceder de nuevo.
    rerender(<Sheet open={false} onClose={onClose} />)
    await flush()
    expect(back).not.toHaveBeenCalled()
  })

  it('cerrar desde la interfaz retrocede una entrada para dejar el historial como estaba', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { rerender } = render(<Sheet open onClose={() => {}} />)

    rerender(<Sheet open={false} onClose={() => {}} />)
    await flush()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('el retroceso real vuelve a la entrada anterior y no dispara un segundo cierre', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<Sheet open onClose={onClose} />)
    rerender(<Sheet open={false} onClose={onClose} />)
    await flush()
    // jsdom entrega el popstate del history.back() de forma asíncrona
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(window.history.state).toEqual({ app: 'restaurante' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sin hoja abierta un popstate no hace nada', () => {
    const onClose = vi.fn()
    render(<Sheet open={false} onClose={onClose} />)
    act(() => firePopState())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dos aperturas seguidas empujan una entrada cada una', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { rerender } = render(<Sheet open onClose={() => {}} />)
    rerender(<Sheet open={false} onClose={() => {}} />)
    await flush()
    rerender(<Sheet open onClose={() => {}} />)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('usa el onClose más reciente, sin tener que volver a suscribirse', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Sheet open onClose={first} />)
    rerender(<Sheet open onClose={second} />)

    act(() => firePopState())
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('desmontar con la hoja abierta deja el historial limpio', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { unmount } = render(<Sheet open onClose={() => {}} />)
    unmount()
    await flush()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('en StrictMode (doble montaje en desarrollo) deja una sola entrada y no se cierra sola', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    const back = vi.spyOn(window.history, 'back')
    const onClose = vi.fn()
    render(
      <StrictMode>
        <Sheet open onClose={onClose} />
      </StrictMode>,
    )
    await flush()

    expect(push).toHaveBeenCalledTimes(1)
    expect(back).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
