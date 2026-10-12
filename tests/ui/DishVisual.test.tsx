import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CategoryVisual } from '../../src/domain/types'
import { DishVisual } from '../../src/ui/DishVisual'

const VISUALS: CategoryVisual[] = ['starter', 'main', 'grill', 'pasta', 'dessert', 'drink']

describe('DishVisual: representación conceptual del plato (plan §9.5)', () => {
  it('sin imagen dibuja un ícono de Phosphor sobre un degradado, decorativo para el lector de pantalla', () => {
    const { container } = render(<DishVisual visual="grill" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.querySelector('svg')).toBeInTheDocument()
    expect(root.querySelector('img')).not.toBeInTheDocument()
    expect(root.className).toContain('gradient')
  })

  it('cada categoría visual tiene su propio ícono (no todos iguales)', () => {
    const icons = VISUALS.map((visual) => {
      const { container, unmount } = render(<DishVisual visual={visual} />)
      const html = container.querySelector('svg')!.innerHTML
      unmount()
      return html
    })
    expect(new Set(icons).size).toBe(VISUALS.length)
  })

  it('mide 96 × 96 px fijos para que no haya saltos al cargar', () => {
    const { container } = render(<DishVisual visual="main" />)
    expect(container.firstElementChild).toHaveClass('size-24', 'shrink-0')
  })

  it('con imageUrl muestra la foto con carga diferida y sin texto alternativo (el nombre ya está en la fila)', () => {
    const { container } = render(<DishVisual visual="main" imageUrl="https://example.com/milanesa.jpg" />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', 'https://example.com/milanesa.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('alt', '')
  })

  it('si la imagen falla vuelve al degradado con ícono', () => {
    const { container } = render(<DishVisual visual="pasta" imageUrl="https://example.com/roto.jpg" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('si cambia la imagen se vuelve a intentar con la nueva', () => {
    const { container, rerender } = render(<DishVisual visual="pasta" imageUrl="https://example.com/roto.jpg" />)
    fireEvent.error(container.querySelector('img')!)
    rerender(<DishVisual visual="pasta" imageUrl="https://example.com/nueva.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/nueva.jpg')
  })

  it('no disponible: apagado en gris para que se note sin depender solo del texto', () => {
    const { container, rerender } = render(<DishVisual visual="drink" />)
    expect(container.firstElementChild).not.toHaveClass('grayscale')
    rerender(<DishVisual visual="drink" unavailable />)
    expect(container.firstElementChild).toHaveClass('grayscale')
  })
})
