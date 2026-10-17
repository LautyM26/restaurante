// Contratos de la capa de servicios (plan §7.1). Las pantallas dependen SOLO de este archivo (RNF4).
// Independiente del transporte (RNF10): aquí no hay canales, sockets, sobres ni estados de conexión.
import type {
  CreateOrderInput,
  LineIssueReason,
  Menu,
  Order,
  OrderEvent,
  OrderStatus,
} from '../domain/types'

export type ServiceErrorCode =
  | 'NETWORK'
  | 'SERVER'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_TABLE'
  | 'LINES_REJECTED'
  | 'PRICE_CHANGED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'STATUS_CONFLICT'

export interface ServiceErrorDetails {
  /** LINES_REJECTED: cada línea rechazada con su motivo. */
  lines?: { lineId: string; dishId: string; reason: LineIssueReason; optionId?: string; groupId?: string }[]
  /** PRICE_CHANGED: total vigente y precio unitario vigente de cada línea (el cliente compara con lo que vio). */
  totalCents?: number
  priceLines?: { lineId: string; unitPriceCents: number }[]
  /** STATUS_CONFLICT: el pedido tal como está ahora. */
  order?: Order
}

/** Error tipado de los servicios; la interfaz lo traduce a mensajes (plan §7.1). */
export class ServiceError extends Error {
  // Campos declarados a mano: `erasableSyntaxOnly` no admite propiedades de parámetro.
  code: ServiceErrorCode
  details?: ServiceErrorDetails

  constructor(code: ServiceErrorCode, message: string, details?: ServiceErrorDetails) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.details = details
  }
}

/** Qué pedidos quiere recibir un suscriptor: los de unas mesas, o todos (panel del personal, Spec 002). */
export type SubscriptionFilter = { kind: 'tables'; tableIds: number[] } | { kind: 'staff' }

export interface MenuService {
  getMenu(): Promise<Menu>
  /** `null` si la mesa no existe. */
  getTable(tableId: number): Promise<{ id: number } | null>
}

export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<Order>
  /** Resuelve un intento de resultado desconocido (RF26): `null` si nunca se registró. */
  findByClientRequestId(clientRequestId: string): Promise<Order | null>
  /** Omite los pedidos inexistentes. */
  getOrders(ids: string[]): Promise<Order[]>
  /** `since`: solo pedidos cuyo `updatedAt` es posterior (re-sincronización y Spec 002). */
  listOrders(filter: { tableIds?: number[]; statuses?: OrderStatus[]; since?: string }): Promise<Order[]>
  /** Solo la Spec 002 cambia estados; el cliente no. */
  updateOrderStatus(id: string, status: OrderStatus, expectedStatus: OrderStatus): Promise<Order>
  /** Devuelve la función para cancelar la suscripción. */
  subscribe(listener: (event: OrderEvent) => void, filter: SubscriptionFilter): () => void
}

export interface Services {
  menuService: MenuService
  orderService: OrderService
}

// Extensión reservada para la Spec 002 ("Llamar al mozo", RNF9). NO se implementa en la 001:
// un servicio aparte, para que el contrato de pedidos no cambie.
//
//   interface TableService {
//     callWaiter(tableId: number, note?: string): Promise<{ callId: string }>
//     subscribe(listener: (e: TableEvent) => void, filter: SubscriptionFilter): () => void
//   }
//   type TableEvent = { type: 'table.waiter_called'; callId: string; tableId: number; at: string }
//
// El adaptador WebSocket compartirá una sola conexión: los mensajes `order.*` van a los listeners de
// OrderService, los `table.*` a los de TableService y los tipos desconocidos se ignoran.
