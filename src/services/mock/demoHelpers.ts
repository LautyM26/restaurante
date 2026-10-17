// Ayudas de demostración para la consola del navegador (plan §7.2). SOLO en desarrollo: permiten probar a
// mano cambios de estado (RF39, RF40), de precio (RF46) y de disponibilidad (RF27, RF44) sin el panel de la 002.
//
//   window.__demo.list()                         pedidos guardados
//   window.__demo.setStatus('K7F2', 'preparing') cambia el estado por código o id
//   window.__demo.advance('K7F2')                pasa al siguiente estado del flujo
//   window.__demo.setPrice('flan', 650000)       precio en centavos
//   window.__demo.setAvailable('flan', false)    agota (o repone) un plato
//   window.__demo.reset()                        borra pedidos y cambios de la carta
import { ORDER_FLOW, isFinal, stepIndex } from '../../domain/orderStatus'
import type { Order, OrderStatus } from '../../domain/types'
import { ServiceError } from '../contracts'
import type { MockMenuService } from './mockMenuService'
import type { MockOrderService } from './mockOrderService'

export interface DemoHelpers {
  list(): Promise<Order[]>
  setStatus(codeOrId: string, status: OrderStatus): Promise<Order>
  advance(codeOrId: string): Promise<Order>
  setPrice(dishId: string, priceCents: number): void
  setAvailable(dishId: string, available: boolean): void
  reset(): Promise<void>
}

declare global {
  interface Window {
    __demo?: DemoHelpers
  }
}

interface DemoServices {
  menuService: MockMenuService
  orderService: MockOrderService
}

export interface InstallOptions {
  /** Por defecto, `import.meta.env.DEV`: en producción no se instala nada. */
  isDev?: boolean
  target?: { __demo?: DemoHelpers }
}

/** Instala `window.__demo` y lo devuelve; fuera de desarrollo no hace nada y devuelve `undefined`. */
export function installDemoHelpers(
  { menuService, orderService }: DemoServices,
  { isDev = import.meta.env.DEV, target = window }: InstallOptions = {},
): DemoHelpers | undefined {
  if (!isDev) return undefined

  const find = async (codeOrId: string): Promise<Order> => {
    const key = codeOrId.toUpperCase()
    const order = (await orderService.listOrders({})).find((o) => o.id === codeOrId || o.code === key)
    if (!order) throw new ServiceError('NOT_FOUND', `No hay un pedido con código o id "${codeOrId}"`)
    return order
  }

  const setStatus = async (codeOrId: string, status: OrderStatus) => {
    const order = await find(codeOrId)
    return orderService.updateOrderStatus(order.id, status, order.status)
  }

  const demo: DemoHelpers = {
    list: () => orderService.listOrders({}),
    setStatus,
    async advance(codeOrId) {
      const order = await find(codeOrId)
      const next = ORDER_FLOW[stepIndex(order.status) + 1]
      if (isFinal(order.status) || !next) {
        throw new ServiceError('INVALID_TRANSITION', `El pedido ${order.code} ya está en un estado final (${order.status})`)
      }
      return orderService.updateOrderStatus(order.id, next, order.status)
    },
    setPrice: (dishId, priceCents) => menuService.setPrice(dishId, priceCents),
    setAvailable: (dishId, available) => menuService.setAvailable(dishId, available),
    async reset() {
      orderService.reset()
      menuService.resetOverrides()
    },
  }
  target.__demo = demo
  return demo
}
