import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import type { Services } from '../../src/services/contracts'
import { ServicesProvider } from '../../src/services/ServicesContext'
import { useMenu } from '../../src/state/useMenu'
import { createFakeOrderService } from '../fixtures/fakeOrderService'
import { makeDish, menu as fixtureMenu, starters } from '../fixtures/menu'

type GetMenu = Services['menuService']['getMenu']

/** Promesa que se resuelve o rechaza a mano, para ver los estados intermedios. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let lastMenu: Menu | undefined

/** Muestra lo que expone el hook en el DOM y guarda la referencia de la carta para comparar identidades. */
function Probe() {
  const state = useMenu()
  lastMenu = state.status === 'ready' ? state.menu : undefined
  return (
    <>
      <p>Estado: {state.status}</p>
      <p>Sin conexión: {state.status === 'error' ? String(state.offline) : 'n/a'}</p>
      <p>Platos: {state.status === 'ready' ? state.menu.dishes.map((d) => d.id).join(',') : 'ninguno'}</p>
      <p>Categorías: {state.status === 'ready' ? state.menu.categories.map((c) => c.id).join(',') : 'ninguna'}</p>
      <button onClick={state.retry}>reintentar</button>
      <button onClick={state.refresh}>refrescar</button>
    </>
  )
}

function setup(getMenu: GetMenu) {
  const getMenuMock = vi.fn(getMenu)
  const services: Services = {
    menuService: { getMenu: getMenuMock, getTable: async (id) => ({ id }) },
    orderService: createFakeOrderService(),
  }
  const view = render(
    <ServicesProvider services={services}>
      <Probe />
    </ServicesProvider>,
  )
  return { getMenu: getMenuMock, ...view }
}

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const setOnline = (online: boolean) => vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online)

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  lastMenu = undefined
})

describe('useMenu: carga, reintento y refresco silencioso (RF8, RF9, RF45; plan §5.2)', () => {
  describe('carga inicial', () => {
    it('arranca en loading y pasa a ready con la carta', async () => {
      const pending = deferred<Menu>()
      setup(() => pending.promise)
      expect(screen.getByText('Estado: loading')).toBeInTheDocument()

      await act(async () => pending.resolve(fixtureMenu))
      expect(screen.getByText('Estado: ready')).toBeInTheDocument()
    })

    it('entrega la carta ordenada y depurada: por order, sin platos huérfanos ni categorías vacías (RF7, CL4, CL36)', async () => {
      setup(async () => fixtureMenu)
      await screen.findByText('Estado: ready')

      expect(screen.getByText('Categorías: starters,mains')).toBeInTheDocument()
      expect(screen.getByText('Platos: a_first,burger,salad,b_second,sold_out,trapped')).toBeInTheDocument()
    })

    it('pide la carta una sola vez al montar', async () => {
      const { getMenu } = setup(async () => fixtureMenu)
      await screen.findByText('Estado: ready')
      expect(getMenu).toHaveBeenCalledTimes(1)
    })

    it('una carta sin platos queda ready y vacía (la pantalla decide qué mostrar, RF10)', async () => {
      setup(async () => ({ categories: [starters], dishes: [] }))
      await screen.findByText('Estado: ready')
      expect(screen.getByText('Platos:')).toBeInTheDocument()
      expect(screen.getByText('Categorías:')).toBeInTheDocument()
    })
  })

  describe('error y reintento (RF9)', () => {
    it('si falla pasa a error y no es "sin conexión" cuando el servidor respondió mal', async () => {
      setOnline(true)
      setup(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      expect(await screen.findByText('Estado: error')).toBeInTheDocument()
      expect(screen.getByText('Sin conexión: false')).toBeInTheDocument()
    })

    it('un error NETWORK se marca como sin conexión', async () => {
      setOnline(true)
      setup(async () => {
        throw new ServiceError('NETWORK', 'sin red')
      })
      await screen.findByText('Estado: error')
      expect(screen.getByText('Sin conexión: true')).toBeInTheDocument()
    })

    it('con el navegador sin conexión también, aunque el error no sea tipado', async () => {
      setOnline(false)
      setup(async () => {
        throw new TypeError('Failed to fetch')
      })
      await screen.findByText('Estado: error')
      expect(screen.getByText('Sin conexión: true')).toBeInTheDocument()
    })

    it('retry vuelve a loading, pide de nuevo y llega a ready', async () => {
      const second = deferred<Menu>()
      let calls = 0
      const { getMenu } = setup(() => {
        if (++calls === 1) return Promise.reject(new ServiceError('SERVER', 'caído'))
        return second.promise
      })
      await screen.findByText('Estado: error')

      await userEvent.click(screen.getByRole('button', { name: 'reintentar' }))
      expect(screen.getByText('Estado: loading')).toBeInTheDocument()
      expect(getMenu).toHaveBeenCalledTimes(2)

      await act(async () => second.resolve(fixtureMenu))
      expect(screen.getByText('Estado: ready')).toBeInTheDocument()
    })

    it('si el reintento también falla vuelve a error', async () => {
      const { getMenu } = setup(async () => {
        throw new ServiceError('SERVER', 'caído')
      })
      await screen.findByText('Estado: error')
      await userEvent.click(screen.getByRole('button', { name: 'reintentar' }))
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
      expect(await screen.findByText('Estado: error')).toBeInTheDocument()
    })

    it('al volver la conexión reintenta solo, igual que la mesa', async () => {
      let calls = 0
      const { getMenu } = setup(async () => {
        if (++calls === 1) throw new ServiceError('NETWORK', 'sin red')
        return fixtureMenu
      })
      await screen.findByText('Estado: error')

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(await screen.findByText('Estado: ready')).toBeInTheDocument()
      expect(getMenu).toHaveBeenCalledTimes(2)
    })

    it('el evento online no hace nada si la carta ya cargó', async () => {
      const { getMenu } = setup(async () => fixtureMenu)
      await screen.findByText('Estado: ready')
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(getMenu).toHaveBeenCalledTimes(1)
    })

    it('al volver a primer plano con error reintenta (el cliente pudo arreglar la conexión)', async () => {
      let calls = 0
      const { getMenu } = setup(async () => {
        if (++calls === 1) throw new ServiceError('NETWORK', 'sin red')
        return fixtureMenu
      })
      await screen.findByText('Estado: error')

      setVisibility('visible')
      expect(await screen.findByText('Estado: ready')).toBeInTheDocument()
      expect(getMenu).toHaveBeenCalledTimes(2)
    })
  })

  describe('refresco silencioso al volver a primer plano (RF45)', () => {
    it('al volver a la pestaña pide la carta de nuevo SIN pasar por loading y aplica los cambios', async () => {
      let calls = 0
      const { getMenu } = setup(async () => {
        calls++
        return calls === 1
          ? fixtureMenu
          : { ...fixtureMenu, dishes: [...fixtureMenu.dishes, makeDish('new_dish', { categoryId: 'mains', order: 99 })] }
      })
      await screen.findByText('Estado: ready')

      const seen: string[] = []
      const watcher = new MutationObserver(() => seen.push(document.body.textContent ?? ''))
      watcher.observe(document.body, { childList: true, subtree: true, characterData: true })

      setVisibility('visible')
      await waitFor(() => expect(screen.getByText(/new_dish/)).toBeInTheDocument())
      watcher.disconnect()

      expect(getMenu).toHaveBeenCalledTimes(2)
      expect(seen.some((text) => text.includes('Estado: loading'))).toBe(false)
    })

    it('no refresca cuando la pestaña pasa a segundo plano', async () => {
      const { getMenu } = setup(async () => fixtureMenu)
      await screen.findByText('Estado: ready')
      setVisibility('hidden')
      expect(getMenu).toHaveBeenCalledTimes(1)
    })

    it('si el refresco falla no muestra error y conserva la carta que ya tenía', async () => {
      let calls = 0
      const { getMenu } = setup(async () => {
        if (++calls === 2) throw new ServiceError('NETWORK', 'sin red')
        return fixtureMenu
      })
      await screen.findByText('Estado: ready')

      setVisibility('visible')
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
      await act(async () => {})

      expect(screen.getByText('Estado: ready')).toBeInTheDocument()
      expect(screen.getByText(/burger/)).toBeInTheDocument()
    })

    it('después de un fallo, el próximo disparador vuelve a intentarlo', async () => {
      let calls = 0
      const { getMenu } = setup(async () => {
        if (++calls === 2) throw new ServiceError('NETWORK', 'sin red')
        return fixtureMenu
      })
      await screen.findByText('Estado: ready')
      setVisibility('visible')
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
      await act(async () => {})
      setVisibility('visible')
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(3))
    })

    it('mientras la carga inicial sigue en curso no dispara un segundo pedido', async () => {
      const pending = deferred<Menu>()
      const { getMenu } = setup(() => pending.promise)
      setVisibility('visible')
      expect(getMenu).toHaveBeenCalledTimes(1)
      await act(async () => pending.resolve(fixtureMenu))
    })

    it('mientras hay un refresco en curso no apila otro', async () => {
      const second = deferred<Menu>()
      let calls = 0
      const { getMenu } = setup(() => (++calls === 1 ? Promise.resolve(fixtureMenu) : second.promise))
      await screen.findByText('Estado: ready')

      setVisibility('visible')
      setVisibility('visible')
      expect(getMenu).toHaveBeenCalledTimes(2)
      await act(async () => second.resolve(fixtureMenu))
    })

    it('si la carta no cambió conserva el mismo objeto (sin re-render en cascada ni saltos)', async () => {
      const { getMenu } = setup(async () => structuredClone(fixtureMenu))
      await screen.findByText('Estado: ready')
      const before = lastMenu

      setVisibility('visible')
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
      await act(async () => {})

      expect(lastMenu).toBe(before)
    })

    it('un evento justo después de cargar ya cuenta: el estado vigente no espera a un efecto', async () => {
      const first = deferred<Menu>()
      let calls = 0
      const { getMenu } = setup(() => (++calls === 1 ? first.promise : Promise.resolve(fixtureMenu)))

      // Todo dentro de un mismo act: los efectos pasivos todavía no corrieron cuando llega el evento.
      await act(async () => {
        first.resolve(fixtureMenu)
        await first.promise
        await Promise.resolve()
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(getMenu).toHaveBeenCalledTimes(2)
    })

    it('el refresh expuesto (lo usará el envío tras un rechazo) también es silencioso', async () => {
      const { getMenu } = setup(async () => fixtureMenu)
      await screen.findByText('Estado: ready')
      await userEvent.click(screen.getByRole('button', { name: 'refrescar' }))
      expect(screen.getByText('Estado: ready')).toBeInTheDocument()
      await waitFor(() => expect(getMenu).toHaveBeenCalledTimes(2))
    })
  })

  it('al desmontar quita sus oyentes', async () => {
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const { unmount } = setup(async () => fixtureMenu)
    await screen.findByText('Estado: ready')
    unmount()
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('una respuesta que llega después de desmontar se ignora sin romper', async () => {
    const pending = deferred<Menu>()
    const { unmount } = setup(() => pending.promise)
    unmount()
    await expect(act(async () => pending.resolve(fixtureMenu))).resolves.not.toThrow()
  })
})
