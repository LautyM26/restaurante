import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../../src/state/useNow'

describe('useNow: la hora actual que se refresca sola (RF48)', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-11T12:00:00.000Z') }))
  afterEach(() => vi.useRealTimers())

  it('devuelve la hora actual y la actualiza en cada intervalo', () => {
    const { result } = renderHook(() => useNow(30_000))
    expect(result.current).toBe(Date.parse('2026-10-11T12:00:00.000Z'))

    act(() => void vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(Date.parse('2026-10-11T12:00:30.000Z'))
    act(() => void vi.advanceTimersByTime(60_000))
    expect(result.current).toBe(Date.parse('2026-10-11T12:01:30.000Z'))
  })

  it('al desmontar deja de actualizarse (no deja temporizadores)', () => {
    const { unmount } = renderHook(() => useNow(30_000))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
