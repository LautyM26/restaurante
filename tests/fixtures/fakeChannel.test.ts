import { describe, expect, it } from 'vitest'
import { createFakeChannelHub } from './fakeChannel'

describe('fakeChannel (simula BroadcastChannel entre pestañas)', () => {
  it('entrega el mensaje a los otros canales con el mismo nombre, no al que lo envía', () => {
    const hub = createFakeChannelHub()
    const a = hub.factory('orders')
    const b = hub.factory('orders')
    const c = hub.factory('orders')
    const received: Record<string, unknown[]> = { a: [], b: [], c: [] }
    a.onmessage = (e) => received.a.push(e.data)
    b.onmessage = (e) => received.b.push(e.data)
    c.onmessage = (e) => received.c.push(e.data)

    a.postMessage({ n: 1 })

    expect(received.a).toEqual([])
    expect(received.b).toEqual([{ n: 1 }])
    expect(received.c).toEqual([{ n: 1 }])
  })

  it('aísla por nombre, copia el dato y deja de entregar tras close()', () => {
    const hub = createFakeChannelHub()
    const a = hub.factory('orders')
    const b = hub.factory('orders')
    const other = hub.factory('otra')
    const got: unknown[] = []
    const gotOther: unknown[] = []
    b.onmessage = (e) => got.push(e.data)
    other.onmessage = (e) => gotOther.push(e.data)

    const payload = { nested: { n: 1 } }
    a.postMessage(payload)
    payload.nested.n = 99 // mutar después no debe afectar lo recibido

    expect(got).toEqual([{ nested: { n: 1 } }])
    expect(gotOther).toEqual([])

    b.close()
    a.postMessage({ n: 2 })
    expect(got).toHaveLength(1)
  })
})
