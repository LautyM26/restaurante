import { screen } from '@testing-library/react'
import { useI18n } from '../src/i18n/I18nContext'
import { useTable } from '../src/state/TableContext'
import { createTestServices } from './fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from './utils'

// Triangulación del helper: debe detectar un problema real y aprobar un DOM correcto.
describe('expectNoA11yViolations', () => {
  it('falla con una imagen sin texto alternativo', async () => {
    const { container } = renderWithProviders(<img src="x.png" />)
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/image-alt/)
  })

  it('aprueba una imagen con texto alternativo', async () => {
    const { container } = renderWithProviders(<img src="x.png" alt="Plato de la casa" />)
    await expectNoA11yViolations(container)
  })
})

describe('renderWithProviders', () => {
  it('arranca en la URL indicada', () => {
    renderWithProviders(<p>hola</p>, { url: '/?mesa=12#/orders' })
    expect(window.location.search).toBe('?mesa=12')
    expect(window.location.hash).toBe('#/orders')
  })
})

describe('renderWithProviders: i18n y table', () => {
  function Probe() {
    const { lang } = useI18n()
    const { status } = useTable()
    return <p>{lang}/{status}</p>
  }

  it('monta idioma y mesa leyendo ?mesa= de la URL', async () => {
    const services = createTestServices()
    renderWithProviders(<Probe />, { url: '/?mesa=12', services, i18n: true, table: true })
    expect(screen.getByText('es/checking')).toBeInTheDocument()
    expect(await screen.findByText('es/valid')).toBeInTheDocument()
    expect(services.menuService.getTable).toHaveBeenCalledWith(12)
  })

  it('sin ?mesa la mesa queda missing', () => {
    renderWithProviders(<Probe />, { url: '/', services: createTestServices(), i18n: true, table: true })
    expect(screen.getByText('es/missing')).toBeInTheDocument()
  })
})
