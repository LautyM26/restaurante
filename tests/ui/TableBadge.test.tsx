import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../src/i18n/I18nContext'
import { LanguageToggle } from '../../src/features/layout/LanguageToggle'
import { TableBadge } from '../../src/ui/TableBadge'
import { expectNoA11yViolations } from '../utils'

const renderBadge = (tableId: number) =>
  render(
    <I18nProvider>
      <LanguageToggle />
      <TableBadge tableId={tableId} />
    </I18nProvider>,
  )

describe('TableBadge', () => {
  beforeEach(() => window.localStorage.clear())

  it('muestra "Mesa 12" y, con otro número, ese número', () => {
    const { unmount } = renderBadge(12)
    expect(screen.getByText('Mesa 12')).toBeInTheDocument()
    unmount()

    renderBadge(5)
    expect(screen.getByText('Mesa 5')).toBeInTheDocument()
    expect(screen.queryByText('Mesa 12')).not.toBeInTheDocument()
  })

  it('traduce el texto al cambiar de idioma', async () => {
    renderBadge(12)
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(screen.getByText('Table 12')).toBeInTheDocument()
  })

  it('mide 36 px de alto con radio de 12 px y lleva un azulejo de 28 px con el ícono', () => {
    renderBadge(12)
    const badge = screen.getByText('Mesa 12').closest('div')!
    expect(badge).toHaveClass('h-9', 'rounded-badge')
    const tile = badge.querySelector('[aria-hidden="true"]')!
    expect(tile).toHaveClass('size-7')
    expect(tile.querySelector('svg')).toBeInTheDocument()
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderBadge(12)
    await expectNoA11yViolations(container)
  })
})
