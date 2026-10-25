import type { Order, OrderStatus } from "@/domain/types";

/** Flujo lineal del pedido; `cancelled` queda fuera (se alcanza desde cualquier no final). */
export const ORDER_FLOW: readonly OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
];

export const FINAL_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "cancelled",
];

/** Un paso adelante o atrás en ORDER_FLOW; cancelar desde cualquier no final (D-025, D-048, D-060). */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to || FINAL_STATUSES.includes(from)) return false;
  if (to === "cancelled") return true;
  const i = ORDER_FLOW.indexOf(from);
  const j = ORDER_FLOW.indexOf(to);
  return Math.abs(i - j) === 1;
}

export type TransitionResult =
  | { kind: "noop"; order: Order }
  | { kind: "conflict"; order: Order }
  | { kind: "invalid" }
  | { kind: "applied"; order: Order; previousStatus: OrderStatus };

/** Orden de chequeo: noop -> conflict -> invalid -> applied (D-052). */
export function applyTransition(
  order: Order,
  to: OrderStatus,
  expectedStatus: OrderStatus,
  now: Date,
): TransitionResult {
  if (to === order.status) return { kind: "noop", order };
  if (order.status !== expectedStatus) return { kind: "conflict", order };
  if (!canTransition(order.status, to)) return { kind: "invalid" };
  return {
    kind: "applied",
    order: withStatus(order, to, now),
    previousStatus: order.status,
  };
}

export type ClientCancelResult =
  | { kind: "invalid"; order: Order }
  | { kind: "applied"; order: Order; previousStatus: "pending" };

/** El cliente solo cancela desde `pending` (R6.1, R6.2). */
export function applyClientCancel(order: Order, now: Date): ClientCancelResult {
  if (order.status !== "pending") return { kind: "invalid", order };
  return {
    kind: "applied",
    order: withStatus(order, "cancelled", now),
    previousStatus: "pending",
  };
}

function withStatus(order: Order, status: OrderStatus, now: Date): Order {
  const at = now.toISOString();
  return {
    ...order,
    status,
    updatedAt: at,
    statusHistory: [...order.statusHistory, { status, at }],
  };
}
