import { render, screen } from '@testing-library/react'
import { GlassPill } from '../../src/ui/GlassPill'

describe('GlassPill', () => {
  it('es un div de vidrio de radio completo por defecto', () => {
    render(<GlassPill data-testid="pill">contenido</GlassPill>)
    const pill = screen.getByTestId('pill')
    expect(pill.tagName).toBe('DIV')
    expect(pill).toHaveClass('glass', 'rounded-full')
    expect(pill).toHaveTextContent('contenido')
  })

  it('puede ser otro elemento semántico y suma clases y atributos sin perder el vidrio', () => {
    render(
      <GlassPill as="nav" aria-label="Principal" className="h-14 px-2">
        <a href="#/">inicio</a>
      </GlassPill>,
    )
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(nav).toHaveClass('glass', 'rounded-full', 'h-14', 'px-2')
  })
})
