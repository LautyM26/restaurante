import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHashScreen } from '../../src/app/useHashScreen'

function start(url: string, options?: Parameters<typeof useHashScreen>[0]) {
  window.history.replaceState(null, '', url)
  return renderHook(() => useHashScreen(options))
}

describe('useHashScreen: navegación por hash sin router (plan §5.8)', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))
  afterEach(() => vi.restoreAllMocks())

  describe('pantalla inicial', () => {
    it.each([
      ['/', 'menu'],
      ['/?mesa=12', 'menu'],
      ['/#/', 'menu'],
      ['/#/orders', 'orders'],
      ['/?mesa=12#/orders', 'orders'],
      ['/#/orders/', 'orders'],
    ] as const)('%s abre %s', (url, screen) => {
      const { result } = start(url)
      expect(result.current.screen).toBe(screen)
    })

    it.each(['/#/nope', '/#orders', '/#/orders/extra', '/#/ORDERS'])('un hash desconocido (%s) cae en la carta', (url) => {
      const { result } = start(url)
      expect(result.current.screen).toBe('menu')
    })
  })

  describe('navigate', () => {
    it('agrega una entrada con from="menu", conserva ?mesa y cambia la pantalla', () => {
      const { result } = start('/?mesa=12')
      const before = window.history.length

      act(() => result.current.navigate('orders'))

      expect(result.current.screen).toBe('orders')
      expect(window.location.hash).toBe('#/orders')
      expect(window.location.search).toBe('?mesa=12')
      expect(window.history.state).toEqual({ app: 'restaurante', from: 'menu' })
      expect(window.history.length).toBe(before + 1)
    })

    it('ir a la pantalla en la que ya está no agrega entradas', () => {
      const { result } = start('/#/orders')
      const before = window.history.length

      act(() => result.current.navigate('orders'))

      expect(window.history.length).toBe(before)
      expect(result.current.screen).toBe('orders')
    })

    it('con replace reemplaza la entrada actual en lugar de sumar otra', () => {
      const { result } = start('/')
      const before = window.history.length

      act(() => result.current.navigate('orders', { replace: true }))

      expect(window.history.length).toBe(before)
      expect(window.location.hash).toBe('#/orders')
      expect(result.current.screen).toBe('orders')
    })

    it('puede volver a la carta con navigate("menu")', () => {
      const { result } = start('/#/orders')
      act(() => result.current.navigate('menu'))
      expect(result.current.screen).toBe('menu')
      expect(window.location.hash).toBe('#/')
      expect(window.history.state).toEqual({ app: 'restaurante', from: 'orders' })
    })
  })

  describe('goBackToMenu', () => {
    it('si se vino de la carta hace history.back() y la pantalla vuelve por popstate', async () => {
      const { result } = start('/?mesa=12')
      act(() => result.current.navigate('orders'))
      const back = vi.spyOn(window.history, 'back')

      act(() => result.current.goBackToMenu())

      expect(back).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(result.current.screen).toBe('menu'))
      expect(window.location.hash).toBe('')
      expect(window.location.search).toBe('?mesa=12')
    })

    it('si se entró directo a #/orders reemplaza la entrada por la carta y no suma historial', () => {
      const { result } = start('/?mesa=12#/orders')
      const back = vi.spyOn(window.history, 'back')
      const before = window.history.length

      act(() => result.current.goBackToMenu())

      expect(back).not.toHaveBeenCalled()
      expect(result.current.screen).toBe('menu')
      expect(window.location.hash).toBe('#/')
      expect(window.location.search).toBe('?mesa=12')
      expect(window.history.length).toBe(before)
    })

    it('estando en la carta no hace nada', () => {
      const { result } = start('/')
      const back = vi.spyOn(window.history, 'back')
      const replace = vi.spyOn(window.history, 'replaceState')

      act(() => result.current.goBackToMenu())

      expect(back).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(result.current.screen).toBe('menu')
    })
  })

  describe('"atrás" del sistema y cambios de hash', () => {
    it('reacciona a popstate', () => {
      const { result } = start('/')
      window.history.replaceState(null, '', '/#/orders')

      act(() => void window.dispatchEvent(new PopStateEvent('popstate')))

      expect(result.current.screen).toBe('orders')
    })

    it('reacciona a hashchange (el usuario edita la URL)', async () => {
      const { result } = start('/')

      act(() => {
        window.location.hash = '#/orders'
      })

      await waitFor(() => expect(result.current.screen).toBe('orders'))
    })

    it('el botón atrás del navegador, tras navigate, vuelve a la carta', async () => {
      const { result } = start('/')
      act(() => result.current.navigate('orders'))

      act(() => window.history.back())

      await waitFor(() => expect(result.current.screen).toBe('menu'))
    })

    it('quita sus oyentes al desmontarse', () => {
      const { unmount } = start('/')
      const remove = vi.spyOn(window, 'removeEventListener')

      unmount()

      const removed = remove.mock.calls.map(([type]) => type)
      expect(removed).toEqual(expect.arrayContaining(['popstate', 'hashchange']))
    })
  })

  describe('onLeave (para guardar el scroll de la carta antes de que cambie el DOM)', () => {
    it('avisa con la pantalla que se deja al navegar y al volver', async () => {
      const onLeave = vi.fn()
      const { result } = start('/', { onLeave })

      act(() => result.current.navigate('orders'))
      expect(onLeave).toHaveBeenLastCalledWith('menu')

      act(() => result.current.goBackToMenu())
      await waitFor(() => expect(result.current.screen).toBe('menu'))
      expect(onLeave).toHaveBeenLastCalledWith('orders')
      expect(onLeave).toHaveBeenCalledTimes(2)
    })

    it('no avisa si la pantalla no cambia', () => {
      const onLeave = vi.fn()
      const { result } = start('/', { onLeave })

      act(() => result.current.navigate('menu'))
      act(() => void window.dispatchEvent(new PopStateEvent('popstate')))

      expect(onLeave).not.toHaveBeenCalled()
    })

    it('avisa también cuando el cambio viene del sistema (atrás o adelante)', () => {
      const onLeave = vi.fn()
      start('/', { onLeave })
      window.history.replaceState(null, '', '/#/orders')

      act(() => void window.dispatchEvent(new PopStateEvent('popstate')))

      expect(onLeave).toHaveBeenCalledWith('menu')
    })
  })
})
