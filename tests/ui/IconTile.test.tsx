import { render, screen } from '@testing-library/react'
import { Fire, ForkKnife } from '@phosphor-icons/react'
import { IconTile } from '../../src/ui/IconTile'

describe('IconTile', () => {
  it('muestra el ícono recibido, decorativo para el lector de pantalla', () => {
    render(<IconTile icon={Fire} data-testid="tile" />)
    const tile = screen.getByTestId('tile')
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile.querySelector('svg')).toBeInTheDocument()
  })

  it('tamaño md de 32 px por defecto y sm de 28 px', () => {
    const { rerender } = render(<IconTile icon={Fire} data-testid="tile" />)
    expect(screen.getByTestId('tile')).toHaveClass('size-8')

    rerender(<IconTile icon={ForkKnife} size="sm" data-testid="tile" />)
    expect(screen.getByTestId('tile')).toHaveClass('size-7')
    expect(screen.getByTestId('tile')).not.toHaveClass('size-8')
  })

  it('usa el degradado de brasa del lenguaje visual', () => {
    render(<IconTile icon={Fire} data-testid="tile" />)
    expect(screen.getByTestId('tile').className).toContain('ember')
  })
})
