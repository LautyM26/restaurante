import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ORDER_FLOW } from '../../src/domain/orderStatus'
import type { OrderStatus } from '../../src/domain/types'
import { StatusPill } from '../../src/ui/StatusPill'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

const ALL: OrderStatus[] = [...ORDER_FLOW, 'cancelled']
const TEXT_ES: Record<OrderStatus, string> = {
  pending: 'Enviado',
  accepted: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo para servir',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

describe('StatusPill: estado del pedido con ícono y texto (plan §9.5)', () => {
  beforeEach(() => window.localStorage.clear())

  it.each(ALL)('muestra el texto de "%s" en español', (status) => {
    renderWithProviders(<StatusPill status={status} />, { i18n: true })
    expect(screen.getByText(TEXT_ES[status])).toBeInTheDocument()
  })

  it('cada estado tiene su propio ícono decorativo (no se depende del color)', () => {
    const icons = ALL.map((status) => {
      const { container, unmount } = renderWithProviders(<StatusPill status={status} />, { i18n: true })
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      const markup = svg!.innerHTML
      unmount()
      return markup
    })
    expect(new Set(icons).size).toBe(ALL.length)
  })

  it('usa el idioma guardado y no tiene violaciones de accesibilidad', async () => {
    window.localStorage.setItem('restaurante.lang', 'en')
    const { container } = renderWithProviders(<StatusPill status="ready" />, { i18n: true })
    expect(screen.getByText('Ready to serve')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})
