import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

// Integración de T4: la app monta el proveedor de idioma y, hasta T5, el selector dentro de <main>.
describe('App con idioma', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('arranca en español con el selector de idioma dentro de main', () => {
    renderWithProviders(<App />)

    const main = screen.getByRole('main')
    expect(within(main).getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()
    expect(within(main).getByRole('radio', { name: 'Español' })).toBeChecked()
    expect(document.documentElement.lang).toBe('es')
    expect(within(main).getByText(/Elegí tus platos/)).toBeInTheDocument()
  })

  it('al cambiar a inglés traduce el texto y recuerda la elección tras recargar', async () => {
    const first = renderWithProviders(<App />)
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(screen.getByText(/Pick your dishes/)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')

    first.unmount()
    renderWithProviders(<App />)
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
    expect(screen.getByText(/Pick your dishes/)).toBeInTheDocument()
  })

  it('no tiene violaciones de accesibilidad con el selector montado', async () => {
    const { container } = renderWithProviders(<App />)
    await expectNoA11yViolations(container)
  })
})
