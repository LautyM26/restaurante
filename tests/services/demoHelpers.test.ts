import { describe, expect, it, vi } from 'vitest'
import type { CreateOrderInput, Order } from '../../src/domain/types'
import { ServiceError } from '../../src/services/contracts'
import { installDemoHelpers } from '../../src/services/mock/demoHelpers'
import type { DemoHelpers } from '../../src/services/mock/demoHelpers'
import { createMockMenuService } from '../../src/services/mock/mockMenuService'
import { createMockOrderService } from '../../src/services/mock/mockOrderService'
import { createSafeStorage } from '../../src/services/storage'
import { createFakeChannelHub } from '../fixtures/fakeChannel'
import { createMemoryStorage } from '../fixtures/storage'

function setup() {
  const backing = createMemoryStorage()
  const storage = createSafeStorage(() => backing)
  const menuService = createMockMenuService({ storage, latencyMs: 0 })
  let n = 0
  const orderService = createMockOrderService({
    storage,
    channelFactory: createFakeChannelHub().factory,
    newId: () => `order-${++n}`,
    latencyMs: 0,
    autoAdvance: false,
    menuService,
  })
  const target: { __demo?: DemoHelpers } = {}
  const demo = installDemoHelpers({ menuService, orderService }, { target })
  if (!demo) throw new Error('Se esperaba que las ayudas se instalaran')
  return { menuService, orderService, target, demo }
}

/** Un flan ($5.900,00) en la mesa 12. */
const flanOrder = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  clientRequestId: 'req-1',
  tableId: 12,
  items: [{ lineId: 'l1', dishId: 'flan', quantity: 1, selection: {} }],
  expectedTotalCents: 590000,
  ...over,
})

async function rejection(promise: Promise<unknown>): Promise<ServiceError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError)
    return error as ServiceError
  }
  throw new Error('Se esperaba un rechazo')
}

describe('instalación (solo con DEV)', () => {
  it('instala window.__demo cuando es desarrollo', () => {
    const { target, demo } = setup()
    expect(target.__demo).toBe(demo)
    expect(Object.keys(demo).sort()).toEqual(['advance', 'list', 'reset', 'setAvailable', 'setPrice', 'setStatus'])
  })

  it('no instala nada fuera de desarrollo', () => {
    const backing = createMemoryStorage()
    const storage = createSafeStorage(() => backing)
    const menuService = createMockMenuService({ storage, latencyMs: 0 })
    const orderService = createMockOrderService({ storage, latencyMs: 0, autoAdvance: false, menuService, channelFactory: undefined })
    const target: { __demo?: DemoHelpers } = {}

    const result = installDemoHelpers({ menuService, orderService }, { isDev: false, target })

    expect(result).toBeUndefined()
    expect(target.__demo).toBeUndefined()
  })
})

describe('pedidos: list, setStatus, advance', () => {
  it('list devuelve los pedidos del servicio', async () => {
    const { orderService, demo } = setup()
    const order = await orderService.createOrder(flanOrder())
    expect(await demo.list()).toEqual([order])
  })

  it('setStatus llama a updateOrderStatus con el estado actual como esperado, por código o por id', async () => {
    const { orderService, demo } = setup()
    const spy = vi.spyOn(orderService, 'updateOrderStatus')
    const order = await orderService.createOrder(flanOrder())

    const accepted = await demo.setStatus(order.code, 'accepted')
    expect(spy).toHaveBeenLastCalledWith(order.id, 'accepted', 'pending')
    expect(accepted.status).toBe('accepted')

    const preparing = await demo.setStatus(order.id, 'preparing')
    expect(spy).toHaveBeenLastCalledWith(order.id, 'preparing', 'accepted')
    expect(preparing.status).toBe('preparing')
  })

  it('el código se acepta en minúsculas', async () => {
    const { orderService, demo } = setup()
    const order = await orderService.createOrder(flanOrder())
    expect((await demo.setStatus(order.code.toLowerCase(), 'cancelled')).status).toBe('cancelled')
  })

  it('setStatus con un pedido inexistente o una transición inválida se rechaza con el error del servicio', async () => {
    const { orderService, demo } = setup()
    const order = await orderService.createOrder(flanOrder())

    expect((await rejection(demo.setStatus('NOPE', 'accepted'))).code).toBe('NOT_FOUND')
    expect((await rejection(demo.setStatus(order.code, 'delivered'))).code).toBe('INVALID_TRANSITION')
  })

  it('advance recorre el flujo hasta entregado', async () => {
    const { orderService, demo } = setup()
    const order = await orderService.createOrder(flanOrder())

    const seen: Order['status'][] = []
    for (let i = 0; i < 4; i++) seen.push((await demo.advance(order.code)).status)

    expect(seen).toEqual(['accepted', 'preparing', 'ready', 'delivered'])
  })

  it('advance no puede avanzar un pedido en estado final', async () => {
    const { orderService, demo } = setup()
    const delivered = await orderService.createOrder(flanOrder({ clientRequestId: 'a' }))
    for (let i = 0; i < 4; i++) await demo.advance(delivered.id)
    const cancelled = await orderService.createOrder(flanOrder({ clientRequestId: 'b' }))
    await demo.setStatus(cancelled.id, 'cancelled')

    expect((await rejection(demo.advance(delivered.id))).code).toBe('INVALID_TRANSITION')
    expect((await rejection(demo.advance(cancelled.id))).code).toBe('INVALID_TRANSITION')
  })
})

describe('carta: setPrice y setAvailable', () => {
  it('llaman al servicio de la carta y se reflejan en getMenu', async () => {
    const { menuService, demo } = setup()
    const price = vi.spyOn(menuService, 'setPrice')
    const available = vi.spyOn(menuService, 'setAvailable')

    demo.setPrice('flan', 650000)
    demo.setAvailable('chocolate-volcano', false)

    expect(price).toHaveBeenCalledWith('flan', 650000)
    expect(available).toHaveBeenCalledWith('chocolate-volcano', false)
    const { dishes } = await menuService.getMenu()
    expect(dishes.find((d) => d.id === 'flan')?.priceCents).toBe(650000)
    expect(dishes.find((d) => d.id === 'chocolate-volcano')?.available).toBe(false)
  })

  it('un cambio de precio hace que el siguiente envío con el total viejo sea PRICE_CHANGED (RF46)', async () => {
    const { orderService, demo } = setup()
    demo.setPrice('flan', 650000)
    const error = await rejection(orderService.createOrder(flanOrder()))
    expect(error.code).toBe('PRICE_CHANGED')
    expect(error.details?.totalCents).toBe(650000)
  })

  it('un plato marcado agotado hace que el envío sea LINES_REJECTED (RF27)', async () => {
    const { orderService, demo } = setup()
    demo.setAvailable('flan', false)
    const error = await rejection(orderService.createOrder(flanOrder()))
    expect(error.code).toBe('LINES_REJECTED')
    expect(error.details?.lines).toEqual([{ lineId: 'l1', dishId: 'flan', reason: 'dish_unavailable' }])
  })

  it('un plato inexistente se informa en la consola', () => {
    const { demo } = setup()
    expect(() => demo.setPrice('no-existe', 100)).toThrow(/no-existe/)
  })
})

describe('reset', () => {
  it('borra los pedidos y los cambios de la carta', async () => {
    const { orderService, menuService, demo } = setup()
    await orderService.createOrder(flanOrder())
    demo.setPrice('flan', 650000)

    await demo.reset()

    expect(await demo.list()).toEqual([])
    const flan = (await menuService.getMenu()).dishes.find((d) => d.id === 'flan')
    expect(flan?.priceCents).toBe(590000)
  })
})
