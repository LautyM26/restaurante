import { describe, expect, it, vi } from 'vitest'
import { createSafeStorage } from '../../src/services/storage'
import { MY_ORDERS_KEY, createMyOrdersStore } from '../../src/state/myOrdersStore'
import { createMemoryStorage, createThrowingStorage } from '../fixtures/storage'

const NOW = '2026-10-11T18:00:00.000Z'
const hoursAgo = (hours: number) => new Date(Date.parse(NOW) - hours * 3_600_000).toISOString()

function makeStore(initial: Record<string, string> = {}, now = NOW) {
  const backing = createMemoryStorage(initial)
  const storage = createSafeStorage(() => backing)
  const store = createMyOrdersStore({ storage, target: new EventTarget(), now: () => now })
  return { store, backing }
}

describe('myOrdersStore: registro local de pedidos enviados (RF28; plan §4)', () => {
  it('arranca vacío', () => {
    expect(makeStore().store.read()).toEqual([])
  })

  it('add guarda la entrada y read la devuelve', () => {
    const { store, backing } = makeStore()
    store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(1) })

    expect(store.read()).toEqual([{ orderId: 'o1', tableId: 12, createdAt: hoursAgo(1) }])
    expect(JSON.parse(backing.getItem(MY_ORDERS_KEY)!)).toHaveLength(1)
  })

  it('guarda pedidos de mesas distintas (P3) y no repite el mismo pedido', () => {
    const { store } = makeStore()
    store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(2) })
    store.add({ orderId: 'o2', tableId: 5, createdAt: hoursAgo(1) })
    store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(2) })

    expect(store.read().map((e) => [e.orderId, e.tableId])).toEqual([
      ['o1', 12],
      ['o2', 5],
    ])
  })

  it('read solo devuelve lo de las últimas 12 horas', () => {
    const { store } = makeStore()
    store.add({ orderId: 'viejo', tableId: 12, createdAt: hoursAgo(12.5) })
    store.add({ orderId: 'reciente', tableId: 12, createdAt: hoursAgo(11.5) })

    expect(store.read().map((e) => e.orderId)).toEqual(['reciente'])
  })

  it('add descarta lo vencido para que el registro no crezca sin fin', () => {
    const { store, backing } = makeStore()
    store.add({ orderId: 'viejo', tableId: 12, createdAt: hoursAgo(30) })
    store.add({ orderId: 'nuevo', tableId: 12, createdAt: hoursAgo(1) })

    expect(JSON.parse(backing.getItem(MY_ORDERS_KEY)!).map((e: { orderId: string }) => e.orderId)).toEqual(['nuevo'])
  })

  it('ignora un registro dañado o con entradas inválidas', () => {
    const broken = makeStore({ [MY_ORDERS_KEY]: '{no es json' })
    expect(broken.store.read()).toEqual([])

    const mixed = makeStore({
      [MY_ORDERS_KEY]: JSON.stringify([
        { orderId: 'ok', tableId: 3, createdAt: hoursAgo(1) },
        { orderId: 7, tableId: 3, createdAt: hoursAgo(1) },
        { orderId: 'sin-mesa', createdAt: hoursAgo(1) },
        null,
      ]),
    })
    expect(mixed.store.read().map((e) => e.orderId)).toEqual(['ok'])
  })

  it('avisa a los suscriptores de la pestaña al agregar, y deja de avisar al desuscribirse', () => {
    const { store } = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(1) })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.add({ orderId: 'o2', tableId: 12, createdAt: hoursAgo(1) })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reacciona al evento "storage" de otra pestaña solo si cambió su clave', () => {
    const target = new EventTarget()
    const store = createMyOrdersStore({
      storage: createSafeStorage(() => createMemoryStorage()),
      target,
      now: () => NOW,
    })
    const listener = vi.fn()
    store.subscribe(listener)

    target.dispatchEvent(Object.assign(new Event('storage'), { key: 'otra.clave' }))
    expect(listener).not.toHaveBeenCalled()

    target.dispatchEvent(Object.assign(new Event('storage'), { key: MY_ORDERS_KEY }))
    expect(listener).toHaveBeenCalledTimes(1)

    // localStorage.clear() en otra pestaña llega con key === null
    target.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('con el almacenamiento bloqueado no rompe y sigue funcionando en memoria (RNF8)', () => {
    const store = createMyOrdersStore({
      storage: createSafeStorage(() => createThrowingStorage()),
      target: new EventTarget(),
      now: () => NOW,
    })
    expect(store.read()).toEqual([])
    expect(() => store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(1) })).not.toThrow()
    expect(store.read().map((e) => e.orderId)).toEqual(['o1'])
  })

  describe('remove: el restaurante ya no conoce el pedido (NOT_FOUND)', () => {
    it('quita solo los ids pedidos, conserva el resto y avisa a los suscriptores', () => {
      const { store } = makeStore()
      store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(2) })
      store.add({ orderId: 'o2', tableId: 5, createdAt: hoursAgo(1) })
      const listener = vi.fn()
      store.subscribe(listener)

      store.remove(['o1'])

      expect(store.read().map((e) => e.orderId)).toEqual(['o2'])
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('un id que no está registrado no cambia nada ni avisa', () => {
      const { store } = makeStore()
      store.add({ orderId: 'o1', tableId: 12, createdAt: hoursAgo(1) })
      const listener = vi.fn()
      store.subscribe(listener)

      store.remove(['nope'])

      expect(store.read()).toHaveLength(1)
      expect(listener).not.toHaveBeenCalled()
    })
  })
})
