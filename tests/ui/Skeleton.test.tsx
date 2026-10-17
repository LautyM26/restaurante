import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from '../../src/ui/Skeleton'

describe('Skeleton: marcador de carga (RF8)', () => {
  it('es decorativo para el lector de pantalla y parpadea solo si se admite movimiento', () => {
    const { container } = render(<Skeleton />)
    const block = container.firstElementChild as HTMLElement
    expect(block).toHaveAttribute('aria-hidden', 'true')
    expect(block).toHaveClass('motion-safe:animate-pulse')
  })

  it('acepta clases para darle la forma del contenido final', () => {
    const { container } = render(<Skeleton className="h-4 w-32 rounded-full" />)
    expect(container.firstElementChild).toHaveClass('h-4', 'w-32', 'rounded-full')
  })
})
