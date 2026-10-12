import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegionProvider, useAnnounce } from '../../src/ui/LiveRegion'
import { expectNoA11yViolations } from '../utils'

function Announcer({ message = 'Agregado: Milanesa × 2', other = 'Pedido K7F2: En preparación' }) {
  const announce = useAnnounce()
  return (
    <>
      <button onClick={() => announce(message)}>anunciar</button>
      <button onClick={() => announce(other)}>otro</button>
    </>
  )
}

const region = () => screen.getByRole('status')
const flush = () => act(() => void vi.advanceTimersByTime(100))

describe('LiveRegion', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('es una única región viva cortés y atómica, vacía al principio', () => {
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    )
    expect(region()).toHaveAttribute('aria-live', 'polite')
    expect(region()).toHaveAttribute('aria-atomic', 'true')
    expect(region()).toBeEmptyDOMElement()
  })

  it('anuncia el mensaje recibido', () => {
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }))
    flush()
    expect(region()).toHaveTextContent('Agregado: Milanesa × 2')
  })

  it('si se anuncian dos mensajes seguidos queda solo el último', () => {
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'otro' }))
    flush()
    expect(region()).toHaveTextContent('Pedido K7F2: En preparación')
    expect(region()).not.toHaveTextContent('Agregado')
  })

  it('repetir el mismo mensaje lo vacía y lo vuelve a poner para que se lea otra vez', () => {
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }))
    flush()
    expect(region()).toHaveTextContent('Agregado: Milanesa × 2')

    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }))
    expect(region()).toBeEmptyDOMElement()
    flush()
    expect(region()).toHaveTextContent('Agregado: Milanesa × 2')
  })

  it('useAnnounce fuera del provider da un error claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Announcer />)).toThrow(/LiveRegionProvider/)
    spy.mockRestore()
  })

  it('no tiene violaciones de accesibilidad', async () => {
    vi.useRealTimers()
    const { container } = render(
      <LiveRegionProvider>
        <main>
          <Announcer />
        </main>
      </LiveRegionProvider>,
    )
    await expectNoA11yViolations(container)
  })
})
