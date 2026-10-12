import { screen } from '@testing-library/react'
import { App } from '../../src/app/App'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

describe('App (smoke)', () => {
  it('renderiza un único landmark main', () => {
    renderWithProviders(<App />)
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<App />)
    await expectNoA11yViolations(container)
  })
})
