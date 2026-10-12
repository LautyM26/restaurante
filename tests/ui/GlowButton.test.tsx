import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GlowButton } from '../../src/ui/GlowButton'
import { expectNoA11yViolations } from '../utils'

describe('GlowButton: botón "brasa" (plan §9.5)', () => {
  it('es un <button type="button"> con su texto y dispara onClick', async () => {
    const onClick = vi.fn()
    render(<GlowButton onClick={onClick}>Reintentar</GlowButton>)

    const button = screen.getByRole('button', { name: 'Reintentar' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('btn-ember')

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('deshabilitado no dispara onClick y queda apagado para el lector de pantalla', async () => {
    const onClick = vi.fn()
    render(
      <GlowButton disabled onClick={onClick}>
        Enviar pedido
      </GlowButton>,
    )

    const button = screen.getByRole('button', { name: 'Enviar pedido' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('cargando marca aria-busy, no dispara onClick y sigue enfocable', async () => {
    const onClick = vi.fn()
    render(
      <GlowButton loading onClick={onClick}>
        Enviando pedido
      </GlowButton>,
    )

    const button = screen.getByRole('button', { name: 'Enviando pedido' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    // Sin `disabled`: si el botón perdiera el foco al enviar, el teclado quedaría sin lugar.
    expect(button).not.toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()

    button.focus()
    expect(button).toHaveFocus()
  })

  it('sin loading no declara aria-busy', () => {
    render(<GlowButton>Ver pedido</GlowButton>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('wide ocupa todo el ancho; por defecto no', () => {
    const { rerender } = render(<GlowButton>Uno</GlowButton>)
    expect(screen.getByRole('button')).not.toHaveClass('w-full')
    rerender(<GlowButton wide>Uno</GlowButton>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('streak agrega la raya superior (solo la CartBar); size lg sube a 60 px', () => {
    const { rerender } = render(<GlowButton>Uno</GlowButton>)
    expect(screen.getByRole('button')).not.toHaveClass('btn-ember--streak')
    expect(screen.getByRole('button')).not.toHaveClass('btn-ember--lg')

    rerender(
      <GlowButton streak size="lg">
        Uno
      </GlowButton>,
    )
    expect(screen.getByRole('button')).toHaveClass('btn-ember--streak')
    expect(screen.getByRole('button')).toHaveClass('btn-ember--lg')
  })

  it('respeta una className extra y pasa el resto de atributos al botón', () => {
    render(
      <GlowButton className="mt-4" aria-describedby="hint" id="retry">
        Probar
      </GlowButton>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('btn-ember', 'mt-4')
    expect(button).toHaveAttribute('aria-describedby', 'hint')
    expect(button).toHaveAttribute('id', 'retry')
  })

  it('el tipo se puede cambiar a submit', () => {
    render(<GlowButton type="submit">Enviar</GlowButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('sin violaciones de accesibilidad en ningún estado', async () => {
    const { container } = render(
      <div>
        <GlowButton>Normal</GlowButton>
        <GlowButton disabled>Apagado</GlowButton>
        <GlowButton loading>Cargando</GlowButton>
      </div>,
    )
    await expectNoA11yViolations(container)
  })
})
