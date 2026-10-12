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
