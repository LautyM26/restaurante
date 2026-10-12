import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateShortCode } from '../../src/domain/shortCode'
import type { CreateOrderInput, Menu, OrderEvent } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import type { MenuService } from '../../src/services/contracts'
import { createMockOrderService, ORDERS_KEY } from '../../src/services/mock/mockOrderService'
import type { MockOrderServiceDeps } from '../../src/services/mock/mockOrderService'
import { createSafeStorage } from '../../src/services/storage'
import { createFakeChannelHub } from '../fixtures/fakeChannel'
import type { FakeChannelHub } from '../fixtures/fakeChannel'
import { menu as baseMenu } from '../fixtures/menu'
import { makeOrder } from '../fixtures/orders'
import { createMemoryStorage, createThrowingStorage } from '../fixtures/storage'

const T0 = Date.parse('2026-10-11T12:00:00.000Z')
const HOUR = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

/** Números pseudoaleatorios repetibles (mulberry32): códigos distintos pero estables entre corridas. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Devuelve los valores dados en orden y después repite `fallback`. */
function sequence(values: number[], fallback = 0.5) {
  let i = 0
  return () => (i < values.length ? values[i++] : fallback)
}

interface Harness {
  service: ReturnType<typeof createMockOrderService>
  backing: Storage
  hub: FakeChannelHub
  clock: { ms: number }
  menu: Menu
  events: OrderEvent[]
  /** Otra "pestaña": mismo almacenamiento y mismo canal, reloj y menú propios. */
  another: (over?: Partial<MockOrderServiceDeps>) => ReturnType<typeof createMockOrderService>
}

function setup(over: Partial<MockOrderServiceDeps> = {}, backing: Storage = createMemoryStorage()): Harness {
  const hub = createFakeChannelHub()
  const clock = { ms: T0 }
  const menu: Menu = structuredClone(baseMenu)
  const menuService: MenuService = {
    getMenu: async () => structuredClone(menu),
    getTable: async (id) => (Number.isInteger(id) && id >= 1 && id <= 20 ? { id } : null),
  }
  let n = 0
  const build = (extra: Partial<MockOrderServiceDeps> = {}) =>
    createMockOrderService({
      storage: createSafeStorage(() => backing),
      channelFactory: hub.factory,
      now: () => clock.ms,
      random: seeded(7),
      newId: () => `order-${++n}`,
      latencyMs: 0,
      autoAdvance: false,
      menuService,
      ...extra,
      ...over,
    })
  const service = build()
  const events: OrderEvent[] = []
  service.subscribe((e) => events.push(e), { kind: 'staff' })
  return { service, backing, hub, clock, menu, events, another: build }
}

const line = (over: Partial<CreateOrderInput['items'][number]> = {}): CreateOrderInput['items'][number] => ({
  lineId: 'l1',
  dishId: 'burger',
  quantity: 1,
  selection: { cooking: ['rare'] },
  ...over,
})

/** Pedido válido: una hamburguesa al punto "jugoso" ($12.000,00). */
const input = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  clientRequestId: 'req-1',
  tableId: 12,
  items: [line()],
  expectedTotalCents: 1200000,
  ...over,
})

async function rejection(promise: Promise<unknown>): Promise<ServiceError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError)
    return error as ServiceError
  }
  throw new Error('Se esperaba que la operación fuera rechazada')
}

afterEach(() => vi.useRealTimers())

describe('createOrder: pedido nuevo (RF36, RF38)', () => {
  it('crea un pedido pending con código, historial, fechas y total recalculado', async () => {
    const { service } = setup()
    const order = await service.createOrder(
      input({
        items: [
          line({ lineId: 'a', quantity: 2, selection: { cooking: ['medium'], extras: ['cheese', 'ketchup'] }, note: 'sin sal' }),
          line({ lineId: 'b', dishId: 'salad', selection: {} }),
        ],
        note: 'es un cumpleaños',
        expectedTotalCents: 2 * 1250000 + 500000,
      }),
    )

    expect(order).toMatchObject({
      id: 'order-1',
      clientRequestId: 'req-1',
      tableId: 12,
      status: 'pending',
      note: 'es un cumpleaños',
      totalCents: 3000000,
      createdAt: iso(T0),
      updatedAt: iso(T0),
      statusHistory: [{ status: 'pending', at: iso(T0) }],
    })
    expect(order.code).toMatch(/^[2-9A-HJ-NP-Z]{4}$/)
    expect(order.items).toEqual([
      {
        lineId: 'a',
        dishId: 'burger',
        name: { es: 'burger' },
        quantity: 2,
        unitPriceCents: 1250000,
        note: 'sin sal',
        options: [
          { groupId: 'cooking', optionId: 'medium', name: { es: 'medium' }, priceDeltaCents: 0 },
          { groupId: 'extras', optionId: 'cheese', name: { es: 'cheese' }, priceDeltaCents: 50000 },
          { groupId: 'extras', optionId: 'ketchup', name: { es: 'ketchup' }, priceDeltaCents: 0 },
        ],
      },
      { lineId: 'b', dishId: 'salad', name: { es: 'salad' }, quantity: 1, unitPriceCents: 500000, options: [] },
    ])
  })

  it('no incluye `note` cuando no hay nota y deja el pedido guardado', async () => {
    const { service } = setup()
    const order = await service.createOrder(input({ note: '' }))
    expect(order).not.toHaveProperty('note')
    expect(await service.getOrders([order.id])).toEqual([order])
  })

  it('el código es único entre los pedidos de las últimas 24 h', async () => {
    // random = 0 genera siempre "2222"; los siguientes cuatro números dan "ZZZZ".
    const { service, backing } = setup({ random: sequence([0, 0, 0, 0, 0.999, 0.999, 0.999, 0.999]) })
    backing.setItem(ORDERS_KEY, JSON.stringify([makeOrder({ id: 'old', clientRequestId: 'seed', code: '2222', createdAt: iso(T0 - HOUR) })]))

    const order = await service.createOrder(input())
    expect(order.code).toBe('ZZZZ')
  })

  it('reutiliza un código de hace más de 24 h', async () => {
    const { service, backing } = setup({ random: () => 0 })
    backing.setItem(ORDERS_KEY, JSON.stringify([makeOrder({ id: 'old', clientRequestId: 'seed', code: '2222', createdAt: iso(T0 - 25 * HOUR) })]))
    expect((await service.createOrder(input())).code).toBe('2222')
  })

  it('falla con SERVER si no consigue un código libre', async () => {
    const { service, backing } = setup({ random: () => 0 })
    backing.setItem(ORDERS_KEY, JSON.stringify([makeOrder({ id: 'x', clientRequestId: 'seed', code: '2222', createdAt: iso(T0 - HOUR) })]))
    expect((await rejection(service.createOrder(input()))).code).toBe('SERVER')
    expect(await service.listOrders({})).toHaveLength(1)
  })

  it('genera códigos del alfabeto sin ambiguos (reutiliza el dominio)', async () => {
    const { service } = setup()
    const order = await service.createOrder(input())
    // El mismo generador del dominio, con la misma semilla, da el mismo código.
    expect(order.code).toBe(generateShortCode(seeded(7)))
  })
})

describe('createOrder: validación en el orden mesa → forma → líneas → precio', () => {
  it('INVALID_TABLE para una mesa inexistente, sin registrar nada', async () => {
    const { service, events } = setup()
    for (const tableId of [0, 21, 999, 12.5]) {
      const error = await rejection(service.createOrder(input({ tableId })))
      expect(error.code, String(tableId)).toBe('INVALID_TABLE')
    }
    expect(await service.listOrders({})).toEqual([])
    expect(events).toEqual([])
  })

  it('la mesa se valida antes que la forma', async () => {
    const { service } = setup()
    expect((await rejection(service.createOrder(input({ tableId: 99, items: [] })))).code).toBe('INVALID_TABLE')
  })

  it.each([
    ['sin líneas', { items: [] }],
    ['sin identificador de intento', { clientRequestId: '' }],
    ['cantidad 0', { items: [line({ quantity: 0 })] }],
    ['cantidad 21', { items: [line({ quantity: 21 })] }],
    ['cantidad decimal', { items: [line({ quantity: 1.5 })] }],
    ['nota de línea de 141 caracteres', { items: [line({ note: 'x'.repeat(141) })] }],
    ['nota general de 201 caracteres', { note: 'x'.repeat(201) }],
    ['lineId repetido', { items: [line(), line()] }],
    ['lineId vacío', { items: [line({ lineId: '' })] }],
    ['total esperado decimal', { expectedTotalCents: 10.5 }],
  ] satisfies [string, Partial<CreateOrderInput>][])('VALIDATION: %s', async (_name, over) => {
    const { service, events } = setup()
    const error = await rejection(service.createOrder(input(over)))
    expect(error.code).toBe('VALIDATION')
    expect(await service.listOrders({})).toEqual([])
    expect(events).toEqual([])
  })

  it('las notas se miden en caracteres visibles: 140 emojis compuestos son válidos, 141 no', async () => {
    const family = '👨‍👩‍👧'
    const { service } = setup()
    await expect(service.createOrder(input({ items: [line({ note: family.repeat(140) })], clientRequestId: 'ok' }))).resolves.toBeDefined()
    const error = await rejection(service.createOrder(input({ items: [line({ note: family.repeat(141) })], clientRequestId: 'bad' })))
    expect(error.code).toBe('VALIDATION')
  })

  it('LINES_REJECTED informa cada línea inválida con su identificador y motivo (RF27)', async () => {
    const { service } = setup()
    const error = await rejection(
      service.createOrder(
        input({
          items: [
            line({ lineId: 'ok', dishId: 'salad', selection: {} }),
            line({ lineId: 'gone', dishId: 'sold_out', selection: {} }),
            line({ lineId: 'missing', dishId: 'ghost-dish', selection: {} }),
            line({ lineId: 'opt-off', selection: { cooking: ['well_done'] } }),
            line({ lineId: 'opt-gone', selection: { cooking: ['rare'], extras: ['truffle'] } }),
            line({ lineId: 'no-cooking', selection: {} }),
            line({ lineId: 'trapped', dishId: 'trapped', selection: {} }),
          ],
          expectedTotalCents: 1,
        }),
      ),
    )

    expect(error.code).toBe('LINES_REJECTED')
    expect(error.details?.lines).toEqual([
      { lineId: 'gone', dishId: 'sold_out', reason: 'dish_unavailable' },
      { lineId: 'missing', dishId: 'ghost-dish', reason: 'dish_not_found' },
      { lineId: 'opt-off', dishId: 'burger', reason: 'option_unavailable', groupId: 'cooking', optionId: 'well_done' },
      { lineId: 'opt-gone', dishId: 'burger', reason: 'option_not_found', groupId: 'extras', optionId: 'truffle' },
      { lineId: 'no-cooking', dishId: 'burger', reason: 'selection_invalid', groupId: 'cooking' },
      { lineId: 'trapped', dishId: 'trapped', reason: 'dish_unavailable' },
    ])
    expect(await service.listOrders({})).toEqual([])
  })

  it('las líneas se validan antes que el precio', async () => {
    const { service } = setup()
    const error = await rejection(
      service.createOrder(input({ items: [line({ dishId: 'sold_out', selection: {} })], expectedTotalCents: 7 })),
    )
    expect(error.code).toBe('LINES_REJECTED')
  })
})

describe('createOrder: reconfirmación de precio (RF46)', () => {
  it('PRICE_CHANGED trae el total y los precios nuevos y NO registra el pedido', async () => {
    const { service, menu, events } = setup()
    menu.dishes.find((d) => d.id === 'burger')!.priceCents = 1500000 // subió después de que el cliente lo vio

    const error = await rejection(
      service.createOrder(
        input({ items: [line({ lineId: 'a', quantity: 2 }), line({ lineId: 'b', dishId: 'salad', selection: {} })], expectedTotalCents: 2900000 }),
      ),
    )

    expect(error.code).toBe('PRICE_CHANGED')
    expect(error.details?.totalCents).toBe(2 * 1500000 + 500000)
    expect(error.details?.priceLines).toEqual([
      { lineId: 'a', unitPriceCents: 1500000 },
      { lineId: 'b', unitPriceCents: 500000 },
    ])
    expect(await service.listOrders({})).toEqual([])
    expect(await service.findByClientRequestId('req-1')).toBeNull()
    expect(events).toEqual([])
  })

  it('el envío siguiente, con el total aceptado y un intento nuevo, se registra', async () => {
    const { service, menu } = setup()
    menu.dishes.find((d) => d.id === 'burger')!.priceCents = 1500000
    await rejection(service.createOrder(input()))

    const order = await service.createOrder(input({ clientRequestId: 'req-2', expectedTotalCents: 1500000 }))
    expect(order.totalCents).toBe(1500000)
    expect(order.clientRequestId).toBe('req-2')
  })

  it('un total esperado igual al vigente no se rechaza (adicionales incluidos)', async () => {
    const { service } = setup()
    const order = await service.createOrder(
      input({ items: [line({ selection: { cooking: ['rare'], extras: ['bacon'] } })], expectedTotalCents: 1280000 }),
    )
    expect(order.totalCents).toBe(1280000)
  })
})

describe('idempotencia por clientRequestId (RF24, RF26)', () => {
  it('el mismo intento con el mismo contenido devuelve el mismo pedido, sin duplicar ni emitir de nuevo', async () => {
    const { service, events } = setup()
    const first = await service.createOrder(input())
    const second = await service.createOrder(input())

    expect(second).toEqual(first)
    expect(await service.listOrders({})).toHaveLength(1)
    expect(events.map((e) => e.type)).toEqual(['order.created'])
  })

  it('devuelve el original aunque el precio o la disponibilidad hayan cambiado después (CL28)', async () => {
    const { service, menu } = setup()
    const first = await service.createOrder(input())
    menu.dishes.find((d) => d.id === 'burger')!.priceCents = 9999999
    menu.dishes.find((d) => d.id === 'burger')!.available = false

    expect(await service.createOrder(input())).toEqual(first)
  })

  it('el mismo identificador con otro contenido es IDEMPOTENCY_CONFLICT y no registra nada', async () => {
    const { service } = setup()
    await service.createOrder(input())

    const otherQuantity = input({ items: [line({ quantity: 2 })], expectedTotalCents: 2400000 })
    expect((await rejection(service.createOrder(otherQuantity))).code).toBe('IDEMPOTENCY_CONFLICT')
    expect((await rejection(service.createOrder(input({ tableId: 5 })))).code).toBe('IDEMPOTENCY_CONFLICT')
    expect((await rejection(service.createOrder(input({ note: 'otra nota' })))).code).toBe('IDEMPOTENCY_CONFLICT')
    expect(await service.listOrders({})).toHaveLength(1)
  })

  it('dos toques simultáneos con el mismo intento registran un único pedido', async () => {
    const { service, events } = setup()
    const [a, b] = await Promise.all([service.createOrder(input()), service.createOrder(input())])

    expect(a.id).toBe(b.id)
    expect(await service.listOrders({})).toHaveLength(1)
    expect(events.filter((e) => e.type === 'order.created')).toHaveLength(1)
  })

  it('intentos distintos crean pedidos distintos', async () => {
    const { service } = setup()
    const a = await service.createOrder(input({ clientRequestId: 'a' }))
    const b = await service.createOrder(input({ clientRequestId: 'b' }))
    expect(a.id).not.toBe(b.id)
    expect(await service.listOrders({})).toHaveLength(2)
  })

  it('otra pestaña con el mismo almacenamiento también reconoce el intento', async () => {
    const { service, another } = setup()
    const first = await service.createOrder(input())
    const otherTab = another()

    expect(await otherTab.createOrder(input())).toEqual(first)
    expect((await rejection(otherTab.createOrder(input({ tableId: 5 })))).code).toBe('IDEMPOTENCY_CONFLICT')
  })
})

describe('findByClientRequestId, getOrders y listOrders', () => {
  it('findByClientRequestId encuentra el pedido registrado y da null si no existe', async () => {
    const { service } = setup()
    const order = await service.createOrder(input())
    expect(await service.findByClientRequestId('req-1')).toEqual(order)
    expect(await service.findByClientRequestId('otro')).toBeNull()
  })

  it('getOrders devuelve los pedidos pedidos y omite los inexistentes', async () => {
    const { service } = setup()
    const a = await service.createOrder(input({ clientRequestId: 'a' }))
    const b = await service.createOrder(input({ clientRequestId: 'b' }))

    expect((await service.getOrders([a.id, 'no-existe'])).map((o) => o.id)).toEqual([a.id])
    expect((await service.getOrders([a.id, b.id])).map((o) => o.id).sort()).toEqual([a.id, b.id].sort())
    expect(await service.getOrders([])).toEqual([])
  })

  it('listOrders filtra por mesas y por estados, y ordena del más nuevo al más viejo', async () => {
    const { service, clock } = setup()
    const first = await service.createOrder(input({ clientRequestId: 'a', tableId: 12 }))
    clock.ms += 1000
    const second = await service.createOrder(input({ clientRequestId: 'b', tableId: 5 }))
    clock.ms += 1000
    const third = await service.createOrder(input({ clientRequestId: 'c', tableId: 12 }))
    await service.updateOrderStatus(second.id, 'accepted', 'pending')

    expect((await service.listOrders({})).map((o) => o.id)).toEqual([third.id, second.id, first.id])
    expect((await service.listOrders({ tableIds: [12] })).map((o) => o.id)).toEqual([third.id, first.id])
    expect((await service.listOrders({ tableIds: [12, 5] })).map((o) => o.id)).toEqual([third.id, second.id, first.id])
    expect((await service.listOrders({ statuses: ['accepted'] })).map((o) => o.id)).toEqual([second.id])
    expect(await service.listOrders({ tableIds: [12], statuses: ['accepted'] })).toEqual([])
  })

  it('listOrders con `since` devuelve solo los pedidos modificados después (updatedAt posterior)', async () => {
    const { service, clock } = setup()
    const old = await service.createOrder(input({ clientRequestId: 'a' }))
    clock.ms += 60_000
    await service.createOrder(input({ clientRequestId: 'b' }))
    clock.ms += 60_000
    await service.updateOrderStatus(old.id, 'accepted', 'pending') // updatedAt de `old` ahora es posterior

    const since = iso(T0 + 60_000)
    // `recent` se creó exactamente en `since`: no es posterior, no entra.
    expect((await service.listOrders({ since })).map((o) => o.id)).toEqual([old.id])
    expect(await service.listOrders({ since: iso(T0 + 3 * 60_000) })).toEqual([])
  })
})

describe('sin almacenamiento (RNF8)', () => {
  it('funciona en memoria: crea, consulta e impide duplicados', async () => {
    const { service } = setup({}, createThrowingStorage())
    const first = await service.createOrder(input())
    expect(await service.createOrder(input())).toEqual(first)
    expect(await service.findByClientRequestId('req-1')).toEqual(first)
    expect(await service.listOrders({})).toHaveLength(1)
  })
})

describe('updateOrderStatus (RF37, RF39, spec §3.2)', () => {
  it('aplica la transición, actualiza fecha e historial y emite order.status_changed con el estado anterior', async () => {
    const { service, clock, events } = setup()
    const created = await service.createOrder(input())
    clock.ms += 90_000

    const accepted = await service.updateOrderStatus(created.id, 'accepted', 'pending')

    expect(accepted).toMatchObject({ status: 'accepted', updatedAt: iso(T0 + 90_000), createdAt: iso(T0) })
    expect(accepted.statusHistory).toEqual([
      { status: 'pending', at: iso(T0) },
      { status: 'accepted', at: iso(T0 + 90_000) },
    ])
    expect(await service.getOrders([created.id])).toEqual([accepted])
    expect(events.at(-1)).toEqual({ type: 'order.status_changed', order: accepted, previousStatus: 'pending' })

    clock.ms += 1000
    const preparing = await service.updateOrderStatus(created.id, 'preparing', 'accepted')
    expect(events.at(-1)).toEqual({ type: 'order.status_changed', order: preparing, previousStatus: 'accepted' })
  })

  it('cancelar un pedido no final también es válido', async () => {
    const { service } = setup()
    const created = await service.createOrder(input())
    expect((await service.updateOrderStatus(created.id, 'cancelled', 'pending')).status).toBe('cancelled')
  })

  it('pedir el estado que ya tiene no cambia nada ni emite aviso', async () => {
    const { service, clock, events } = setup()
    const created = await service.createOrder(input())
    clock.ms += 5000
    const before = events.length

    const result = await service.updateOrderStatus(created.id, 'pending', 'pending')

    expect(result).toEqual(created)
    expect(result.updatedAt).toBe(iso(T0))
    expect(events).toHaveLength(before)
  })

  it('si el pedido cambió desde lo que veía quien lo pide: STATUS_CONFLICT con el pedido actual', async () => {
    const { service, events } = setup()
    const created = await service.createOrder(input())
    const accepted = await service.updateOrderStatus(created.id, 'accepted', 'pending')
    const before = events.length

    const error = await rejection(service.updateOrderStatus(created.id, 'preparing', 'pending'))

    expect(error.code).toBe('STATUS_CONFLICT')
    expect(error.details?.order).toEqual(accepted)
    expect((await service.getOrders([created.id]))[0].status).toBe('accepted')
    expect(events).toHaveLength(before)
  })

  it('una transición no permitida es INVALID_TRANSITION', async () => {
    const { service } = setup()
    const created = await service.createOrder(input())
    expect((await rejection(service.updateOrderStatus(created.id, 'ready', 'pending'))).code).toBe('INVALID_TRANSITION')

    await service.updateOrderStatus(created.id, 'cancelled', 'pending')
    expect((await rejection(service.updateOrderStatus(created.id, 'accepted', 'cancelled'))).code).toBe('INVALID_TRANSITION')
  })

  it('un pedido inexistente es NOT_FOUND', async () => {
    const { service } = setup()
    expect((await rejection(service.updateOrderStatus('nada', 'accepted', 'pending'))).code).toBe('NOT_FOUND')
  })
})

describe('subscribe (RF39)', () => {
  it('con tableIds recibe solo los pedidos de esas mesas; con staff, todos', async () => {
    const { service } = setup()
    const table12: OrderEvent[] = []
    const table5and7: OrderEvent[] = []
    const staff: OrderEvent[] = []
    service.subscribe((e) => table12.push(e), { kind: 'tables', tableIds: [12] })
    service.subscribe((e) => table5and7.push(e), { kind: 'tables', tableIds: [5, 7] })
    service.subscribe((e) => staff.push(e), { kind: 'staff' })

    const a = await service.createOrder(input({ clientRequestId: 'a', tableId: 12 }))
    await service.createOrder(input({ clientRequestId: 'b', tableId: 5 }))
    await service.updateOrderStatus(a.id, 'accepted', 'pending')

    expect(table12.map((e) => e.type)).toEqual(['order.created', 'order.status_changed'])
    expect(table5and7.map((e) => e.order.tableId)).toEqual([5])
    expect(staff).toHaveLength(3)
  })

  it('deja de recibir al cancelar la suscripción, sin afectar a los demás', async () => {
    const { service } = setup()
    const first: OrderEvent[] = []
    const second: OrderEvent[] = []
    const stop = service.subscribe((e) => first.push(e), { kind: 'staff' })
    service.subscribe((e) => second.push(e), { kind: 'staff' })

    await service.createOrder(input({ clientRequestId: 'a' }))
    stop()
    stop() // cancelar dos veces es inofensivo
    await service.createOrder(input({ clientRequestId: 'b' }))

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(2)
  })

  it('un suscriptor que lanza error no impide registrar el pedido ni avisar a los demás', async () => {
    const { service } = setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: OrderEvent[] = []
    service.subscribe(
      () => {
        throw new Error('suscriptor roto')
      },
      { kind: 'staff' },
    )
    service.subscribe((e) => received.push(e), { kind: 'staff' })

    const order = await service.createOrder(input())

    expect(received).toHaveLength(1)
    expect(await service.getOrders([order.id])).toEqual([order])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('sincronización entre pestañas (RF40, CL31)', () => {
  it('dos instancias con el mismo almacenamiento y canal reciben los eventos de la otra', async () => {
    const { service: tabA, another } = setup()
    const tabB = another()
    const seenByB: OrderEvent[] = []
    const seenByA: OrderEvent[] = []
    tabB.subscribe((e) => seenByB.push(e), { kind: 'tables', tableIds: [12] })
    tabA.subscribe((e) => seenByA.push(e), { kind: 'tables', tableIds: [12] })

    const created = await tabA.createOrder(input())
    expect(seenByB).toEqual([{ type: 'order.created', order: created }])
    expect(seenByA).toEqual([{ type: 'order.created', order: created }]) // una sola vez: sin eco

    // El cambio de estado hecho en la pestaña A se refleja en B (window.__demo.setStatus, "Hecho cuando").
    const accepted = await tabA.updateOrderStatus(created.id, 'accepted', 'pending')
    expect(seenByB.at(-1)).toEqual({ type: 'order.status_changed', order: accepted, previousStatus: 'pending' })
    expect(await tabB.getOrders([created.id])).toEqual([accepted])

    // Y a la inversa.
    const preparing = await tabB.updateOrderStatus(created.id, 'preparing', 'accepted')
    expect(seenByA.at(-1)).toEqual({ type: 'order.status_changed', order: preparing, previousStatus: 'accepted' })
  })

  it('la otra pestaña filtra por sus mesas y por staff', async () => {
    const { service: tabA, another } = setup()
    const tabB = another()
    const otherTable: OrderEvent[] = []
    const staff: OrderEvent[] = []
    tabB.subscribe((e) => otherTable.push(e), { kind: 'tables', tableIds: [5] })
    tabB.subscribe((e) => staff.push(e), { kind: 'staff' })

    await tabA.createOrder(input({ tableId: 12 }))

    expect(otherTable).toEqual([])
    expect(staff).toHaveLength(1)
  })

  it('un cambio sin efecto (mismo estado) no se propaga a la otra pestaña', async () => {
    const { service: tabA, another } = setup()
    const tabB = another()
    const created = await tabA.createOrder(input())
    const seenByB: OrderEvent[] = []
    tabB.subscribe((e) => seenByB.push(e), { kind: 'staff' })

    await tabA.updateOrderStatus(created.id, 'pending', 'pending')

    expect(seenByB).toEqual([])
  })

  it('los eventos recibidos no se reenvían: una tercera pestaña recibe cada evento una sola vez', async () => {
    const { service: tabA, another } = setup()
    const tabB = another()
    const tabC = another()
    const seenByC: OrderEvent[] = []
    tabB.subscribe(() => {}, { kind: 'staff' })
    tabC.subscribe((e) => seenByC.push(e), { kind: 'staff' })

    await tabA.createOrder(input())

    expect(seenByC).toHaveLength(1)
  })

  it('ignora mensajes que no son eventos de pedidos (compatibilidad hacia adelante)', () => {
    const { another, hub } = setup()
    const tabB = another()
    const seen: OrderEvent[] = []
    tabB.subscribe((e) => seen.push(e), { kind: 'staff' })
    const stranger = hub.factory('restaurante.orders')

    for (const garbage of [
      { type: 'table.waiter_called', callId: 'c1', tableId: 12, at: iso(T0) },
      { type: 'order.created' },
      { type: 'order.created', order: 'no es un pedido' },
      null,
      'texto',
      42,
    ]) {
      expect(() => stranger.postMessage(garbage)).not.toThrow()
    }

    expect(seen).toEqual([])
  })

  it('sin canal disponible funciona igual dentro de la pestaña', async () => {
    const { service, events } = setup({ channelFactory: undefined })
    await service.createOrder(input())
    expect(events).toHaveLength(1)
  })
})

describe('avance automático de la demostración (VITE_MOCK_AUTO_ADVANCE)', () => {
  const autoSetup = (autoAdvance = true) => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    return setup({ autoAdvance, now: () => Date.now() })
  }

  it('avanza a accepted (5 s), preparing (10 s), ready (25 s) y delivered (40 s)', async () => {
    const { service, events } = autoSetup()
    const created = await service.createOrder(input())
    const status = async () => (await service.getOrders([created.id]))[0].status

    await vi.advanceTimersByTimeAsync(4999)
    expect(await status()).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    expect(await status()).toBe('accepted')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await status()).toBe('preparing')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await status()).toBe('ready')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await status()).toBe('delivered')

    const changes = events.flatMap((e) => (e.type === 'order.status_changed' ? [[e.previousStatus, e.order.status]] : []))
    expect(changes).toEqual([
      ['pending', 'accepted'],
      ['accepted', 'preparing'],
      ['preparing', 'ready'],
      ['ready', 'delivered'],
    ])
  })

  it('apagado por defecto: el pedido se queda en pending', async () => {
    const { service } = autoSetup(false)
    const created = await service.createOrder(input())
    await vi.advanceTimersByTimeAsync(120_000)
    expect((await service.getOrders([created.id]))[0].status).toBe('pending')
  })

  it('no pisa un cambio manual: un pedido cancelado se queda cancelado', async () => {
    const { service, events } = autoSetup()
    const created = await service.createOrder(input())
    await vi.advanceTimersByTimeAsync(2000)
    await service.updateOrderStatus(created.id, 'cancelled', 'pending')
    const before = events.length

    await vi.advanceTimersByTimeAsync(60_000)

    expect((await service.getOrders([created.id]))[0].status).toBe('cancelled')
    expect(events).toHaveLength(before)
  })

  it('respeta un avance manual sin repetir estados', async () => {
    const { service } = autoSetup()
    const created = await service.createOrder(input())
    await vi.advanceTimersByTimeAsync(2000)
    await service.updateOrderStatus(created.id, 'accepted', 'pending')

    await vi.advanceTimersByTimeAsync(60_000)

    const [order] = await service.getOrders([created.id])
    expect(order.statusHistory.map((h) => h.status)).toEqual(['pending', 'accepted', 'preparing', 'ready', 'delivered'])
  })

  it('un reintento idempotente no programa avances duplicados', async () => {
    const { service, events } = autoSetup()
    await service.createOrder(input())
    await service.createOrder(input())

    await vi.advanceTimersByTimeAsync(60_000)

    expect(events.filter((e) => e.type === 'order.status_changed')).toHaveLength(4)
  })
})

describe('latencia simulada', () => {
  it('las llamadas no resuelven hasta cumplirse la latencia', async () => {
    vi.useFakeTimers()
    const { service } = setup({ latencyMs: 400 })

    let created = false
    const promise = service.createOrder(input()).then((o) => ((created = true), o))
    await vi.advanceTimersByTimeAsync(399)
    expect(created).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await promise).status).toBe('pending')

    let listed = false
    const list = service.listOrders({}).then((o) => ((listed = true), o))
    await vi.advanceTimersByTimeAsync(399)
    expect(listed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await list).toHaveLength(1)
  })
})

describe('reset (ayuda de demo)', () => {
  it('borra los pedidos y los intentos: el mismo intento puede registrarse de nuevo', async () => {
    const { service } = setup()
    const first = await service.createOrder(input())
    service.reset()

    expect(await service.listOrders({})).toEqual([])
    expect(await service.findByClientRequestId('req-1')).toBeNull()
    expect((await service.createOrder(input())).id).not.toBe(first.id)
  })
})
