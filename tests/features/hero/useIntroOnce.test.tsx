import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTRO_STORAGE_KEY, useIntroOnce } from '../../../src/features/hero/useIntroOnce'
import { INTRO_MS } from '../../../src/ui/motion'
import { createThrowingStorage } from '../../fixtures/storage'

const stubReducedMotion = (matches: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: matches && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )

describe('useIntroOnce: la entrada animada una vez por sesión (RF5, RF6, RNF8)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('la primera vez de la sesión se reproduce', () => {
    const { result } = renderHook(() => useIntroOnce())
    expect(result.current).toBe(true)
  })

  it('la segunda vez, en la misma sesión, no se reproduce (por ejemplo tras recargar)', () => {
    renderHook(() => useIntroOnce()).unmount()
    const { result } = renderHook(() => useIntroOnce())
    expect(result.current).toBe(false)
  })

  it('se recuerda en sessionStorage, no en localStorage', () => {
    renderHook(() => useIntroOnce())
    expect(window.sessionStorage.getItem(INTRO_STORAGE_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(INTRO_STORAGE_KEY)).toBeNull()
  })

  it('termina sola: pasado el tiempo de la entrada deja de pedir la secuencia, y no antes', () => {
    const { result } = renderHook(() => useIntroOnce())
    act(() => void vi.advanceTimersByTime(INTRO_MS - 1))
    expect(result.current).toBe(true)
    act(() => void vi.advanceTimersByTime(400))
    expect(result.current).toBe(false)
  })

  it('con movimiento reducido nunca se reproduce', () => {
    stubReducedMotion(true)
    const { result } = renderHook(() => useIntroOnce())
    expect(result.current).toBe(false)
  })

  it('con movimiento reducido no gasta la entrada de la sesión: si se desactiva después, se reproduce', () => {
    const spy = stubReducedMotion(true)
    renderHook(() => useIntroOnce()).unmount()
    spy.mockRestore()
    const { result } = renderHook(() => useIntroOnce())
    expect(result.current).toBe(true)
  })

  it('con el almacenamiento bloqueado se reproduce y no rompe', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(createThrowingStorage())
    const { result } = renderHook(() => useIntroOnce())
    expect(result.current).toBe(true)
    act(() => void vi.advanceTimersByTime(INTRO_MS + 500))
    expect(result.current).toBe(false)
  })

  it('un doble montaje de desarrollo (StrictMode) no se come la entrada', () => {
    const { result } = renderHook(() => useIntroOnce(), { wrapper: StrictMode })
    expect(result.current).toBe(true)
  })
})
