// OrderService simulado (plan §7.2): reglas del restaurante en el cliente para poder demostrar el flujo
// completo sin servidor. Persiste en el almacenamiento (compartido entre pestañas) y respeta en forma el
// contrato REST propuesto (§7.3): mismos códigos de error, mismo orden de validación, misma idempotencia.
import { MAX_QTY, NOTE_MAX, ORDER_NOTE_MAX, CODE_UNIQUE_WINDOW_H } from '../../config'
import { submissionFingerprint } from '../../domain/cart'
import { cartTotalCents, unitPriceCents } from '../../domain/pricing'
import { generateUniqueCode } from '../../domain/shortCode'
import { countVisibleChars } from '../../domain/text'
import { validateLine } from '../../domain/lineValidation'
import { applyTransition, canTransition } from '../../domain/orderStatus'
import type {
  CartLine,
  CreateOrderInput,
  Dish,
  Menu,
  Order,
  OrderEvent,
  OrderItem,
  OrderItemOption,
  OrderStatus,
} from '../../domain/types'
import { createId } from '../../lib/id'
import { ServiceError } from '../contracts'
import type { MenuService, OrderService, ServiceErrorDetails, SubscriptionFilter } from '../contracts'
import type { SafeStorage } from '../storage'
import { wait } from './latency'

/** Pedidos de la demostración (lista de `Order`). */
export const ORDERS_KEY = 'restaurante.mock.orders'
/** Huella del contenido de cada intento registrado: `{ [clientRequestId]: fingerprint }`. */
export const FINGERPRINTS_KEY = 'restaurante.mock.fingerprints'

/** Canal por el que las pestañas del mismo navegador se avisan los eventos (plan §5.6). */
export const CHANNEL_NAME = 'restaurante.orders'

const HOUR_MS = 3_600_000
/** Avance automático de la demo: a los N ms de creado el pedido pasa a ese estado (plan §7.2). */
const AUTO_ADVANCE_STEPS: readonly (readonly [OrderStatus, number])[] = [
  ['accepted', 5_000],
  ['preparing', 10_000],
  ['ready', 25_000],
  ['delivered', 40_000],
]

/** Lo mínimo que se usa de BroadcastChannel; permite inyectar uno falso en los tests. */
export interface ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(data: unknown): void
  close(): void
}
export type ChannelFactory = (name: string) => ChannelLike

const browserChannelFactory: ChannelFactory | undefined =
  typeof BroadcastChannel === 'undefined' ? undefined : (name) => new BroadcastChannel(name) as unknown as ChannelLike

export interface MockOrderService extends OrderService {
  /** Ayuda de demo: borra todos los pedidos. */
  reset(): void
}

export interface MockOrderServiceDeps {
  storage: SafeStorage
  /** Por defecto, BroadcastChannel del navegador; `undefined` explícito = sin canal (solo dentro de la pestaña). */
  channelFactory?: ChannelFactory
  now?: () => number
  random?: () => number
  newId?: () => string
  latencyMs: number
  autoAdvance: boolean
  /** Para validar mesa, líneas y precios con la carta vigente. */
  menuService: Pick<MenuService, 'getMenu' | 'getTable'>
}

const reject = (code: ServiceError['code'], message: string, details?: ServiceErrorDetails): never => {
  throw new ServiceError(code, message, details)
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Mensaje del canal que es un evento de pedidos; cualquier otra cosa se ignora (compatibilidad hacia adelante). */
function isOrderEvent(data: unknown): data is OrderEvent {
  if (!isRecord(data) || !isRecord(data.order)) return false
  if (typeof data.order.id !== 'string' || typeof data.order.tableId !== 'number') return false
  return data.type === 'order.created' || (data.type === 'order.status_changed' && typeof data.previousStatus === 'string')
}

/** Forma del pedido (400 VALIDATION): lo que el servidor real exigiría antes de mirar la carta. */
function validateShape(input: CreateOrderInput): void {
  const fail = (message: string) => reject('VALIDATION', message)
  if (typeof input.clientRequestId !== 'string' || input.clientRequestId === '') fail('Falta el identificador del intento')
  if (!Array.isArray(input.items) || input.items.length === 0) fail('El pedido no tiene líneas')
  if (!Number.isInteger(input.expectedTotalCents)) fail('El total esperado debe ser un entero de centavos')
  if (input.note !== undefined && (typeof input.note !== 'string' || countVisibleChars(input.note) > ORDER_NOTE_MAX)) {
    fail(`La nota general supera los ${ORDER_NOTE_MAX} caracteres`)
  }
  const lineIds = new Set<string>()
  for (const item of input.items) {
    if (!isRecord(item) || typeof item.lineId !== 'string' || item.lineId === '') fail('Una línea no tiene identificador')
    if (lineIds.has(item.lineId)) fail(`Línea repetida: ${item.lineId}`)
    lineIds.add(item.lineId)
    if (typeof item.dishId !== 'string') fail(`La línea ${item.lineId} no indica el plato`)
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY) {
      fail(`La cantidad de la línea ${item.lineId} debe ser un entero de 1 a ${MAX_QTY}`)
    }
    if (!isRecord(item.selection) || !Object.values(item.selection).every(Array.isArray)) {
      fail(`La selección de la línea ${item.lineId} es inválida`)
    }
    if (item.note !== undefined && (typeof item.note !== 'string' || countVisibleChars(item.note) > NOTE_MAX)) {
      fail(`La nota de la línea ${item.lineId} supera los ${NOTE_MAX} caracteres`)
    }
  }
}

/** Huella del contenido del intento (sin su identificador), la misma que usa el cliente (RF26). */
function fingerprintOf({ clientRequestId: _clientRequestId, ...content }: CreateOrderInput): string {
  return submissionFingerprint(content)
}

/** Instantánea de una línea con los precios y nombres vigentes (RF36). */
function buildItem(dish: Dish, item: CreateOrderInput['items'][number]): OrderItem {
  const options: OrderItemOption[] = []
  for (const group of dish.optionGroups) {
    for (const optionId of item.selection[group.id] ?? []) {
      const option = group.options.find((o) => o.id === optionId)
      if (option) options.push({ groupId: group.id, optionId, name: option.name, priceDeltaCents: option.priceDeltaCents })
    }
  }
  return {
    lineId: item.lineId,
    dishId: dish.id,
    name: dish.name,
    quantity: item.quantity,
    unitPriceCents: unitPriceCents(dish, item.selection),
    options,
    ...(item.note ? { note: item.note } : {}),
  }
}

export function createMockOrderService(deps: MockOrderServiceDeps): MockOrderService {
  const { storage, latencyMs, menuService } = deps
  const now = deps.now ?? Date.now
  const random = deps.random ?? Math.random
  const newId = deps.newId ?? createId
  const channelFactory = 'channelFactory' in deps ? deps.channelFactory : browserChannelFactory

  // Cada operación relee el almacenamiento: otra pestaña pudo escribir (ponytail: "la última gana").
  const readOrders = (): Order[] => {
    try {
      const parsed: unknown = JSON.parse(storage.get(ORDERS_KEY) ?? '[]')
      return Array.isArray(parsed) ? (parsed as Order[]) : []
    } catch {
      return []
    }
  }
  const readFingerprints = (): Record<string, string> => {
    try {
      const parsed: unknown = JSON.parse(storage.get(FINGERPRINTS_KEY) ?? '{}')
      return isRecord(parsed) ? (parsed as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  // ---- Suscriptores -------------------------------------------------------------------------------
  const subscribers = new Set<{ listener: (event: OrderEvent) => void; filter: SubscriptionFilter }>()

  const deliver = (event: OrderEvent) => {
    for (const { listener, filter } of [...subscribers]) {
      if (filter.kind === 'tables' && !filter.tableIds.includes(event.order.tableId)) continue
      try {
        listener(event)
      } catch (error) {
        // Un suscriptor roto no debe romper el registro del pedido ni a los demás suscriptores.
        console.error('Error en un suscriptor de pedidos', error)
      }
    }
  }

  // El canal se abre al primer uso. Un BroadcastChannel no entrega a sí mismo lo que envía, por eso el
  // evento se entrega primero a los suscriptores locales y después se publica; lo recibido NO se reenvía.
  let channel: ChannelLike | undefined
  const getChannel = (): ChannelLike | undefined => {
    if (!channel && channelFactory) {
      channel = channelFactory(CHANNEL_NAME)
      channel.onmessage = (message) => {
        if (isOrderEvent(message.data)) deliver(message.data)
      }
    }
    return channel
  }
  const emit = (event: OrderEvent) => {
    deliver(event)
    getChannel()?.postMessage(event)
  }

  // ---- Reglas -------------------------------------------------------------------------------------
  /** Pedido ya registrado con ese intento: lo devuelve si el contenido es el mismo; si no, conflicto. */
  const findRegistered = (input: CreateOrderInput, orders: Order[]): Order | undefined => {
    if (typeof input.clientRequestId !== 'string' || input.clientRequestId === '') return undefined
    const existing = orders.find((o) => o.clientRequestId === input.clientRequestId)
    if (!existing) return undefined
    let fingerprint: string
    try {
      fingerprint = fingerprintOf(input)
    } catch {
      return reject('VALIDATION', 'El pedido tiene un formato inválido')
    }
    if (readFingerprints()[input.clientRequestId] !== fingerprint) {
      return reject('IDEMPOTENCY_CONFLICT', 'Ese intento ya se registró con un contenido distinto')
    }
    return existing
  }

  const transition = (id: string, status: OrderStatus, expectedStatus: OrderStatus): Order => {
    const orders = readOrders()
    const current = orders.find((o) => o.id === id)
    if (!current) return reject('NOT_FOUND', `No existe el pedido ${id}`)
    const result = applyTransition(current, status, expectedStatus, new Date(now()).toISOString())
    switch (result.kind) {
      case 'noop':
        return current
      case 'conflict':
        return reject('STATUS_CONFLICT', 'El pedido cambió de estado', { order: result.current })
      case 'invalid':
        return reject('INVALID_TRANSITION', `No se puede pasar de ${current.status} a ${status}`)
      case 'applied':
        storage.set(ORDERS_KEY, JSON.stringify(orders.map((o) => (o.id === id ? result.order : o))))
        emit({ type: 'order.status_changed', order: result.order, previousStatus: current.status })
        return result.order
    }
  }

  // Solo la pestaña que creó el pedido lo avanza; si el estado ya no admite el paso (cambio manual,
  // cancelación), se omite sin error.
  const scheduleAutoAdvance = (id: string) => {
    for (const [status, afterMs] of AUTO_ADVANCE_STEPS) {
      setTimeout(() => {
        const current = readOrders().find((o) => o.id === id)
        if (current && canTransition(current.status, status)) transition(id, status, current.status)
      }, afterMs)
    }
  }

  return {
    async createOrder(input) {
      await wait(latencyMs)
      if (!isRecord(input)) reject('VALIDATION', 'El pedido tiene un formato inválido')

      // Un intento ya registrado se resuelve antes que nada: su resultado no depende de la carta de hoy (CL28).
      const registered = findRegistered(input, readOrders())
      if (registered) return registered

      // 1. mesa
      if (!(await menuService.getTable(input.tableId))) reject('INVALID_TABLE', `La mesa ${input.tableId} no existe`)
      // 2. forma
      validateShape(input)
      // 3. líneas
      const menu: Menu = await menuService.getMenu()
      const lines: CartLine[] = input.items.map((i) => ({
        key: i.lineId,
        dishId: i.dishId,
        quantity: i.quantity,
        selection: i.selection,
        note: i.note ?? '',
      }))
      const rejected = lines.flatMap((line) =>
        validateLine(menu, line).map((issue) => ({ lineId: line.key, dishId: line.dishId, ...issue })),
      )
      if (rejected.length > 0) reject('LINES_REJECTED', 'Hay líneas que ya no se pueden pedir', { lines: rejected })
      // 4. precio
      const items = input.items.map((i) => buildItem(menu.dishes.find((d) => d.id === i.dishId)!, i))
      const totalCents = cartTotalCents(lines, menu)
      if (totalCents !== input.expectedTotalCents) {
        reject('PRICE_CHANGED', 'El total cambió', {
          totalCents,
          priceLines: items.map((i) => ({ lineId: i.lineId, unitPriceCents: i.unitPriceCents })),
        })
      }

      // Registro: todo lo que sigue es síncrono, así dos envíos simultáneos del mismo intento no se pisan.
      const orders = readOrders()
      const duplicate = findRegistered(input, orders)
      if (duplicate) return duplicate

      const nowMs = now()
      const recentCodes = orders.filter((o) => Date.parse(o.createdAt) > nowMs - CODE_UNIQUE_WINDOW_H * HOUR_MS).map((o) => o.code)
      let code: string
      try {
        code = generateUniqueCode(recentCodes, random)
      } catch {
        return reject('SERVER', 'No se pudo generar un código de pedido')
      }
      const nowIso = new Date(nowMs).toISOString()
      const order: Order = {
        id: newId(),
        code,
        clientRequestId: input.clientRequestId,
        tableId: input.tableId,
        items,
        ...(input.note ? { note: input.note } : {}),
        totalCents,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        statusHistory: [{ status: 'pending', at: nowIso }],
      }
      storage.set(ORDERS_KEY, JSON.stringify([...orders, order]))
      storage.set(FINGERPRINTS_KEY, JSON.stringify({ ...readFingerprints(), [input.clientRequestId]: fingerprintOf(input) }))
      emit({ type: 'order.created', order })
      if (deps.autoAdvance) scheduleAutoAdvance(order.id)
      return order
    },

    async findByClientRequestId(clientRequestId) {
      await wait(latencyMs)
      return readOrders().find((o) => o.clientRequestId === clientRequestId) ?? null
    },

    async getOrders(ids) {
      await wait(latencyMs)
      const wanted = new Set(ids)
      return readOrders().filter((o) => wanted.has(o.id))
    },

    async listOrders({ tableIds, statuses, since }) {
      await wait(latencyMs)
      const sinceMs = since === undefined ? undefined : Date.parse(since)
      return readOrders()
        .filter((o) => !tableIds || tableIds.includes(o.tableId))
        .filter((o) => !statuses || statuses.includes(o.status))
        .filter((o) => sinceMs === undefined || Date.parse(o.updatedAt) > sinceMs)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    },

    async updateOrderStatus(id, status, expectedStatus) {
      await wait(latencyMs)
      return transition(id, status, expectedStatus)
    },

    subscribe(listener, filter) {
      const subscriber = { listener, filter }
      subscribers.add(subscriber)
      getChannel() // empieza a escuchar a las otras pestañas
      return () => {
        subscribers.delete(subscriber)
      }
    },

    reset() {
      storage.remove(ORDERS_KEY)
      storage.remove(FINGERPRINTS_KEY)
    },
  }
}
