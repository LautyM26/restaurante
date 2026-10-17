import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bell } from '@phosphor-icons/react'
import { MotionConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_MS } from '../../src/config'
import { Toast } from '../../src/ui/Toast'
import type { ToastData } from '../../src/ui/Toast'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

const a: ToastData = { id: 1, message: 'Pedido K7F2: En preparación', icon: Bell }
const b: ToastData = { id: 2, message: 'Pedido K7F2: Listo para servir', icon: Bell }

function setup(toast: ToastData | null = a) {
  const onClose = vi.fn()
  const onAction = vi.fn()
  const ui = (data: ToastData | null) => (
    <Toast toast={data} actionLabel="Ver" closeLabel="Cerrar aviso" onAction={onAction} onClose={onClose} />
  )
  const view = renderWithProviders(ui(toast))
  const rerender = (data: ToastData | null) =>
    view.rerender(
      <MotionConfig transition={{ duration: 0 }} reducedMotion="always">
        {ui(data)}
      </MotionConfig>,
    )
  return { ...view, onClose, onAction, rerender }
}

describe('Toast: aviso breve de cambio de estado en la carta (RF47; plan §9.5)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('aparece con el mensaje, el botón "Ver" y el de cerrar', async () => {
    const { container } = setup()
    expect(screen.getByText('Pedido K7F2: En preparación')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('no es una región viva propia (el anuncio sale por la LiveRegion global)', () => {
    const { container } = setup()
    expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  })

  it('sin aviso no dibuja nada', () => {
    const { container } = setup(null)
    expect(container).toBeEmptyDOMElement()
  })

  it('se cierra solo a los 4 s, ni antes ni después', () => {
    const { onClose } = setup()
    act(() => void vi.advanceTimersByTime(TOAST_MS - 100))
    expect(onClose).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(100))
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('se pausa mientras tiene el foco y vuelve a contar al perderlo', () => {
    const { onClose } = setup()
    const see = screen.getByRole('button', { name: 'Ver' })
    act(() => see.focus())
    act(() => void vi.advanceTimersByTime(TOAST_MS * 3))
    expect(onClose).not.toHaveBeenCalled()

    act(() => see.blur())
    act(() => void vi.advanceTimersByTime(TOAST_MS))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('se pausa con el puntero encima', async () => {
    const { onClose } = setup()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const text = screen.getByText('Pedido K7F2: En preparación')
    await user.hover(text)
    act(() => void vi.advanceTimersByTime(TOAST_MS * 2))
    expect(onClose).not.toHaveBeenCalled()
    await user.unhover(text)
    act(() => void vi.advanceTimersByTime(TOAST_MS))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uno a la vez: el aviso nuevo reemplaza al anterior y reinicia la cuenta', () => {
    const { onClose, rerender } = setup(a)
    act(() => void vi.advanceTimersByTime(3000))
    rerender(b)
    expect(screen.queryByText(a.message)).not.toBeInTheDocument()
    expect(screen.getByText(b.message)).toBeInTheDocument()

    act(() => void vi.advanceTimersByTime(3000))
    expect(onClose).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('"Ver" y cerrar llaman a sus acciones', async () => {
    const { onAction, onClose } = setup()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Ver' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
