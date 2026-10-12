import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { createTestServices } from '../fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

const NOTICE_ES = 'Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.'
const NOTICE_EN = 'To order, scan the QR code on your table or ask our staff.'

// Integración de idioma (T4, ajustada en T5): el selector vive en la barra superior y el texto traducible
// es el aviso de mesa de la carta.
describe('App con idioma', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('arranca en español con el selector de idioma en la barra superior', () => {
    renderWithProviders(<App services={createTestServices()} />)

    expect(within(screen.getByRole('banner')).getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked()
    expect(document.documentElement.lang).toBe('es')
    expect(within(screen.getByRole('main')).getByText(NOTICE_ES)).toBeInTheDocument()
  })

  it('al cambiar a inglés traduce el texto y recuerda la elección tras recargar', async () => {
    const services = createTestServices()
    const first = renderWithProviders(<App services={services} />)
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(screen.getByText(NOTICE_EN)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')

    first.unmount()
    renderWithProviders(<App services={services} />)
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
    expect(screen.getByText(NOTICE_EN)).toBeInTheDocument()
  })

  it('no tiene violaciones de accesibilidad con la barra y el aviso montados', async () => {
    const { container } = renderWithProviders(<App services={createTestServices()} />)
    await expectNoA11yViolations(container)
  })
})
