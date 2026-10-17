// Modelo de dominio: contrato compartido con la Spec 002 y con el backend (plan §6).
// JSON camelCase. Importes en centavos enteros (ARS). Fechas ISO 8601 UTC.

export type Lang = 'es' | 'en'
/** Texto en español y, opcionalmente, en inglés (si falta 'en' se usa 'es'). */
export interface LocalizedText {
  es: string
  en?: string
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten_free' | 'spicy'
export type CategoryVisual = 'starter' | 'main' | 'grill' | 'pasta' | 'dessert' | 'drink'

export interface Option {
  id: string
  name: LocalizedText
  priceDeltaCents: number
  available: boolean
}
export interface OptionGroup {
  id: string
  name: LocalizedText
  type: 'single' | 'multiple'
  /** 0 = opcional; >= 1 = obligatorio. */
  min: number
  /** En un grupo 'single' vale 1. */
  max: number
  options: Option[]
}
export interface Dish {
  id: string
  categoryId: string
  order: number
  name: LocalizedText
  description: LocalizedText
  priceCents: number
  imageUrl?: string
  tags: DietaryTag[]
  available: boolean
  featured: boolean
  optionGroups: OptionGroup[]
}
export interface Category {
  id: string
  name: LocalizedText
  order: number
  visual: CategoryVisual
}
export interface Menu {
  categories: Category[]
  dishes: Dish[]
}

/** groupId → ids de las opciones elegidas. */
export type Selection = Record<string, string[]>

export interface CartLine {
  key: string
  dishId: string
  quantity: number
  selection: Selection
  note: string
}
export interface PendingSubmission {
  clientRequestId: string
  fingerprint: string
  startedAt: string
}
export interface CartState {
  lines: CartLine[]
  note: string
  pending?: PendingSubmission
}

export type LineIssueReason =
  | 'dish_not_found'
  | 'dish_unavailable'
  | 'option_not_found'
  | 'option_unavailable'
  | 'selection_invalid'
export interface LineIssue {
  reason: LineIssueReason
  groupId?: string
  optionId?: string
}

/** Error de selección de un grupo: faltan opciones para el mínimo o sobran respecto del máximo. */
export type GroupError =
  | { groupId: string; kind: 'min'; missing: number }
  | { groupId: string; kind: 'max'; excess: number }

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export interface OrderItemOption {
  groupId: string
  optionId: string
  name: LocalizedText
  priceDeltaCents: number
}
export interface OrderItem {
  lineId: string
  dishId: string
  /** Instantánea del nombre al momento del pedido. */
  name: LocalizedText
  quantity: number
  unitPriceCents: number
  options: OrderItemOption[]
  note?: string
}
export interface Order {
  id: string
  code: string
  clientRequestId: string
  tableId: number
  items: OrderItem[]
  note?: string
  totalCents: number
  status: OrderStatus
  createdAt: string
  /** Cambia en cada transición. */
  updatedAt: string
  statusHistory: { status: OrderStatus; at: string }[]
}

export interface CreateOrderInput {
  /** Idempotencia (spec §3.4). */
  clientRequestId: string
  tableId: number
  items: { lineId: string; dishId: string; quantity: number; selection: Selection; note?: string }[]
  note?: string
  /** Reconfirmación de precio (RF46). */
  expectedTotalCents: number
}

/** Unión cerrada: solo eventos de pedidos. */
export type OrderEvent =
  | { type: 'order.created'; order: Order }
  | { type: 'order.status_changed'; order: Order; previousStatus: OrderStatus }

/** Entrada del registro local de pedidos enviados desde este dispositivo. */
export interface MyOrderEntry {
  orderId: string
  tableId: number
  createdAt: string
}
