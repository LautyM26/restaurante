import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PENDING_DELAY_MINUTES } from '../../../src/domain/delay'
import { formatTime } from '../../../src/i18n/format'
import { OrderCard } from '../../../src/features/orders/OrderCard'
import type { Order } from '../../../src/domain/types'
import { makeOrder } from '../../fixtures/orders'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const CREATED = '2026-10-11T12:00:00.000Z'
const createdMs = Date.parse(CREATED)
const DELAYED = 'Tu pedido está tardando, avisá al mozo.'

const withItems = (overrides: Partial<Order> = {}) =>
  makeOrder({
    totalCents: 1850000,
    items: [
      {
        lineId: 'l1',
        dishId: 'burger',
        name: { es: 'Hamburguesa', en: 'Burger' },
        quantity: 2,
        unitPriceCents: 800000,
        options: [{ groupId: 'cooking', optionId: 'medium', name: { es: 'Punto medio', en: 'Medium' }, priceDeltaCents: 0 }],
        note: 'sin cebolla',
      },
      { lineId: 'l2', dishId: 'salad', name: { es: 'Ensalada' }, quantity: 1, unitPriceCents: 250000, options: [] },
    ],
    ...overrides,
  })

const renderCard = (order: Order, props: { highlighted?: boolean } = {}) =>
  renderWithProviders(<OrderCard order={order} {...props} />, { i18n: true })

const timelineItems = () => within(screen.getByRole('list', { name: 'Estado del pedido' })).getAllByRole('listitem')

describe('OrderCard: un pedido en "Mis pedidos" (RF28-RF31, RF48)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('muestra la mesa, el código, la hora de envío y el estado', () => {
    renderCard(makeOrder({ code: 'K7F2', tableId: 12 }))
    expect(screen.getByText('Mesa 12')).toBeInTheDocument()
    expect(screen.getByText('K7F2')).toBeInTheDocument()
    expect(screen.getByText(`Enviado a las ${formatTime(CREATED, 'es')}`)).toBeInTheDocument()
    expect(screen.getAllByText('Enviado').length).toBeGreaterThan(0)
  })

  it('cada pedido lleva su propia mesa (P3)', () => {
    renderCard(makeOrder({ code: 'P3Q9', tableId: 5 }))
    expect(screen.getByText('Mesa 5')).toBeInTheDocument()
    expect(screen.queryByText('Mesa 12')).not.toBeInTheDocument()
  })

  describe('línea de tiempo', () => {
    it('lista los cinco pasos del flujo y marca el actual', () => {
      renderCard(makeOrder({ status: 'preparing' }))
      const items = timelineItems()
      expect(items.map((li) => li.textContent)).toEqual(['Enviado', 'Confirmado', 'En preparación', 'Listo para servir', 'Entregado'])
      const current = items.filter((li) => li.getAttribute('aria-current') === 'step')
      expect(current).toHaveLength(1)
      expect(current[0]).toHaveTextContent('En preparación')
    })

    it('al inicio el paso actual es "Enviado" y al final "Entregado"', () => {
      const { unmount } = renderCard(makeOrder({ status: 'pending' }))
      expect(timelineItems()[0]).toHaveAttribute('aria-current', 'step')
      unmount()
      renderCard(makeOrder({ status: 'delivered' }))
      expect(timelineItems()[4]).toHaveAttribute('aria-current', 'step')
    })

    it('distingue pasos hechos y pendientes con un atributo, no solo con el color', () => {
      renderCard(makeOrder({ status: 'accepted' }))
      expect(timelineItems().map((li) => li.getAttribute('data-step'))).toEqual(['done', 'current', 'todo', 'todo', 'todo'])
    })
  })

  describe('cancelado', () => {
    it('muestra el estado y el mensaje, sin línea de tiempo', () => {
      renderCard(makeOrder({ status: 'cancelled' }))
      expect(screen.getByText('Cancelado')).toBeInTheDocument()
      expect(screen.getByText('Este pedido fue cancelado. Consultá con el personal.')).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Estado del pedido' })).not.toBeInTheDocument()
    })

    it('un pedido no cancelado no muestra ese mensaje', () => {
      renderCard(makeOrder({ status: 'ready' }))
      expect(screen.queryByText(/fue cancelado/)).not.toBeInTheDocument()
    })
  })

  describe('demora de 10 minutos en "Enviado" (RF48, CL33)', () => {
    it('aparece sola al cumplirse el plazo, sin recargar', () => {
      vi.useFakeTimers({ now: createdMs + 9 * 60_000 })
      renderCard(makeOrder())
      expect(screen.queryByText(DELAYED)).not.toBeInTheDocument()

      act(() => void vi.advanceTimersByTime(60_000))
      expect(screen.getByText(DELAYED)).toBeInTheDocument()
    })

    it('ya demorado al mostrarse si pasaron más de 10 minutos', () => {
      vi.useFakeTimers({ now: createdMs + (PENDING_DELAY_MINUTES + 5) * 60_000 })
      renderCard(makeOrder())
      expect(screen.getByText(DELAYED)).toBeInTheDocument()
    })

    it('un pedido ya confirmado no se marca como demorado aunque pase el tiempo', () => {
      vi.useFakeTimers({ now: createdMs + 20 * 60_000 })
      renderCard(makeOrder({ status: 'accepted' }))
      expect(screen.queryByText(DELAYED)).not.toBeInTheDocument()
    })

    it('el aviso es visible para lector de pantalla como nota, no como alerta que interrumpe', () => {
      vi.useFakeTimers({ now: createdMs + 11 * 60_000 })
      renderCard(makeOrder())
      expect(screen.getByText(DELAYED).closest('[role="alert"]')).toBeNull()
    })
  })

  describe('detalle y total', () => {
    it('despliega las líneas con cantidad, opciones, nota y el total', () => {
      renderCard(withItems())
      expect(screen.getByText('Ver detalle')).toBeInTheDocument()
      const details = screen.getByText('Ver detalle').closest('details')!
      expect(within(details).getByText('2 × Hamburguesa')).toBeInTheDocument()
      expect(within(details).getByText(/Punto medio/)).toBeInTheDocument()
      expect(within(details).getByText(/sin cebolla/)).toBeInTheDocument()
      expect(within(details).getByText('1 × Ensalada')).toBeInTheDocument()
      expect(within(details).getByText(/18\.500/)).toBeInTheDocument()
    })

    it('traduce los nombres al inglés con respaldo en español', () => {
      window.localStorage.setItem('restaurante.lang', 'en')
      renderCard(withItems())
      expect(screen.getByText('2 × Burger')).toBeInTheDocument()
      expect(screen.getByText('1 × Ensalada')).toBeInTheDocument() // sin traducción: respaldo en español
      expect(screen.getByText('Table 12')).toBeInTheDocument()
    })
  })

  describe('recién enviado', () => {
    it('destaca la confirmación con el código y el total confirmado (RF25)', () => {
      renderCard(withItems({ code: 'K7F2' }), { highlighted: true })
      expect(screen.getByText('Pedido enviado')).toBeInTheDocument()
      expect(screen.getByText('K7F2')).toBeInTheDocument()
      expect(screen.getAllByText(/18\.500/).length).toBeGreaterThan(0)
    })

    it('un pedido normal no muestra la confirmación', () => {
      renderCard(withItems())
      expect(screen.queryByText('Pedido enviado')).not.toBeInTheDocument()
    })
  })

  it.each([
    ['pending', false],
    ['preparing', false],
    ['cancelled', false],
    ['pending', true],
  ] as const)('no tiene violaciones de accesibilidad (%s, destacado: %s)', async (status, highlighted) => {
    const { container } = renderCard(withItems({ status }), { highlighted })
    await expectNoA11yViolations(container)
  })
})
