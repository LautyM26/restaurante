import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery, useReducedMotionPreference } from '../../src/ui/useMediaQuery'

/** matchMedia controlable: guarda los oyentes para poder disparar "change" a mano. */
function stubMedia(initial: boolean) {
  const listeners = new Set<() => void>()
  const list = {
    matches: initial,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ ...list, media: query, get matches() { return list.matches } }) as unknown as MediaQueryList)
  return {
    spy,
    listeners,
    set(value: boolean) {
      list.matches = value
      listeners.forEach((cb) => cb())
    },
  }
}

describe('useMediaQuery (plan §10.4)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('devuelve si la consulta coincide al montar', () => {
    stubMedia(true)
    expect(renderHook(() => useMediaQuery('(min-width: 768px)')).result.current).toBe(true)
    stubMedia(false)
    expect(renderHook(() => useMediaQuery('(min-width: 768px)')).result.current).toBe(false)
  })

  it('se actualiza si el cliente cambia el ajuste con la app abierta', () => {
    const media = stubMedia(false)
    const { result } = renderHook(() => useMediaQuery('(prefers-reduced-motion: reduce)'))
    expect(result.current).toBe(false)
    act(() => media.set(true))
    expect(result.current).toBe(true)
    act(() => media.set(false))
    expect(result.current).toBe(false)
  })

  it('al desmontar deja de escuchar', () => {
    const media = stubMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(media.listeners.size).toBe(1)
    unmount()
    expect(media.listeners.size).toBe(0)
  })

  it('useReducedMotionPreference consulta prefers-reduced-motion', () => {
    const media = stubMedia(true)
    expect(renderHook(() => useReducedMotionPreference()).result.current).toBe(true)
    expect(media.spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('sin matchMedia asume que no coincide y no rompe', () => {
    const original = window.matchMedia
    // @ts-expect-error simula un navegador sin matchMedia
    window.matchMedia = undefined
    try {
      expect(renderHook(() => useMediaQuery('(min-width: 768px)')).result.current).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })
})
