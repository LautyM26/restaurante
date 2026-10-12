import { describe, expect, it } from 'vitest'
import { ServiceError } from '../../src/services/contracts'
import contractsSource from '../../src/services/contracts.ts?raw'
import { makeOrder } from '../fixtures/orders'

describe('ServiceError', () => {
  it('es un Error con código tipado y mensaje', () => {
    const error = new ServiceError('NOT_FOUND', 'No existe el pedido')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ServiceError)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('No existe el pedido')
    expect(error.name).toBe('ServiceError')
    expect(error.details).toBeUndefined()
  })

  it('conserva el detalle de cada tipo de rechazo', () => {
    const rejected = new ServiceError('LINES_REJECTED', 'Líneas inválidas', {
      lines: [{ lineId: 'l1', dishId: 'burger', reason: 'dish_unavailable' }],
    })
    expect(rejected.details?.lines).toEqual([{ lineId: 'l1', dishId: 'burger', reason: 'dish_unavailable' }])

    const priceChanged = new ServiceError('PRICE_CHANGED', 'Cambió el precio', {
      totalCents: 250000,
      priceLines: [{ lineId: 'l1', unitPriceCents: 125000 }],
    })
    expect(priceChanged.details?.totalCents).toBe(250000)

    const order = makeOrder({ status: 'preparing' })
    const conflict = new ServiceError('STATUS_CONFLICT', 'Estado distinto', { order })
    expect(conflict.details?.order).toBe(order)
  })
})

describe('contracts.ts es independiente del transporte (RNF10)', () => {
  it('no menciona canales, sockets ni HTTP en sus tipos', () => {
    // Se ignoran los comentarios: la regla es sobre lo que expone la interfaz.
    const code = contractsSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    // Palabra completa: `clientRequestId` no debe confundirse con el tipo `Request` de HTTP.
    for (const forbidden of ['BroadcastChannel', 'WebSocket', 'fetch', 'Response', 'Request', 'XMLHttpRequest', 'localStorage']) {
      expect(code).not.toMatch(new RegExp(String.raw`\b${forbidden}\b`))
    }
  })

  it('el detector de palabras prohibidas funciona (no pasa en vacío)', () => {
    const sample = 'interface X { socket: WebSocket; id: clientRequestId }'
    expect(sample).toMatch(new RegExp(String.raw`\bWebSocket\b`))
    expect(sample).not.toMatch(new RegExp(String.raw`\bRequest\b`))
  })
})
