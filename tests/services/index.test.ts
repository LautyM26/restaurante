import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMockServices, createServices, readMockConfig } from '../../src/services'
import { createSafeStorage } from '../../src/services/storage'
import { createFakeChannelHub } from '../fixtures/fakeChannel'
import { createMemoryStorage } from '../fixtures/storage'

afterEach(() => vi.useRealTimers())

describe('readMockConfig (.env.example)', () => {
  it('usa 400 ms de latencia y avance automático apagado por defecto', () => {
    expect(readMockConfig({})).toEqual({ latencyMs: 400, autoAdvance: false })
  })

  it('lee la latencia, incluido 0 (que no debe confundirse con "sin valor")', () => {
    expect(readMockConfig({ VITE_MOCK_LATENCY_MS: '0' }).latencyMs).toBe(0)
    expect(readMockConfig({ VITE_MOCK_LATENCY_MS: '150' }).latencyMs).toBe(150)
  })

  it('ignora una latencia inválida', () => {
    for (const bad of ['', 'abc', '-5', '1.5', '12px']) {
      expect(readMockConfig({ VITE_MOCK_LATENCY_MS: bad }).latencyMs, bad).toBe(400)
    }
  })

  it('el avance automático se activa solo con "true"', () => {
    expect(readMockConfig({ VITE_MOCK_AUTO_ADVANCE: 'true' }).autoAdvance).toBe(true)
    for (const other of ['false', '1', 'TRUE', '', undefined]) {
      expect(readMockConfig({ VITE_MOCK_AUTO_ADVANCE: other }).autoAdvance, String(other)).toBe(false)
    }
  })
})

describe('buildMockServices', () => {
  const build = (latencyMs = 0) => {
    const backing = createMemoryStorage()
    return buildMockServices(
      { latencyMs, autoAdvance: false },
      { storage: createSafeStorage(() => backing), channelFactory: createFakeChannelHub().factory },
    )
  }

  it('arma la carta y los pedidos de demostración, de punta a punta', async () => {
    const { menuService, orderService } = build()
    const { dishes } = await menuService.getMenu()
    const flan = dishes.find((d) => d.id === 'flan')!

    const order = await orderService.createOrder({
      clientRequestId: 'r1',
      tableId: 12,
      items: [{ lineId: 'l1', dishId: 'flan', quantity: 2, selection: {} }],
      expectedTotalCents: flan.priceCents * 2,
    })

    expect(order.totalCents).toBe(flan.priceCents * 2)
    expect(await orderService.getOrders([order.id])).toEqual([order])
  })

  it('la latencia de un pedido es una sola (no se suma la de la carta que consulta por dentro)', async () => {
    vi.useFakeTimers()
    const { orderService } = build(400)

    let done = false
    const promise = orderService
      .createOrder({
        clientRequestId: 'r1',
        tableId: 12,
        items: [{ lineId: 'l1', dishId: 'flan', quantity: 1, selection: {} }],
        expectedTotalCents: 590000,
      })
      .then((o) => ((done = true), o))

    await vi.advanceTimersByTimeAsync(400)
    expect(done).toBe(true)
    await promise
  })
})

describe('createServices', () => {
  it('es el único punto de armado y devuelve siempre la misma instancia', () => {
    const services = createServices()
    expect(createServices()).toBe(services)
    expect(typeof services.menuService.getMenu).toBe('function')
    expect(typeof services.orderService.subscribe).toBe('function')
  })
})
