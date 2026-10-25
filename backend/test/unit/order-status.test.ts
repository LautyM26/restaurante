import { describe, expect, it } from "vitest";
import {
  FINAL_STATUSES,
  ORDER_FLOW,
  applyClientCancel,
  applyTransition,
  canTransition,
} from "@/domain/order-status";
import type { Order, OrderStatus } from "@/domain/types";

const ALL: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

// Transiciones permitidas (R5.3, D-060); todo lo demás es falso.
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "pending", "cancelled"],
  preparing: ["ready", "accepted", "cancelled"],
  ready: ["delivered", "preparing", "cancelled"],
  delivered: [],
  cancelled: [],
};

const NOW = new Date("2026-10-25T12:00:00.000Z");

function order(status: OrderStatus): Order {
  return {
    id: "o1",
    code: "AB23",
    clientRequestId: "c1",
    tableId: 1,
    items: [],
    totalCents: 1000,
    status,
    createdAt: "2026-10-25T11:00:00.000Z",
    updatedAt: "2026-10-25T11:00:00.000Z",
    statusHistory: [{ status: "pending", at: "2026-10-25T11:00:00.000Z" }],
  };
}

describe("constants", () => {
  it("defines flow and final statuses", () => {
    expect(ORDER_FLOW).toEqual([
      "pending",
      "accepted",
      "preparing",
      "ready",
      "delivered",
    ]);
    expect(FINAL_STATUSES).toEqual(["delivered", "cancelled"]);
  });
});

describe("canTransition (6x6)", () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const expected = ALLOWED[from].includes(to);
      it(`${from} -> ${to} is ${expected}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("applyTransition", () => {
  it("noop when to equals current status, even if expectedStatus differs", () => {
    const o = order("accepted");
    expect(applyTransition(o, "accepted", "pending", NOW)).toEqual({
      kind: "noop",
      order: o,
    });
  });

  it("noop on a final status with same target", () => {
    expect(
      applyTransition(order("delivered"), "delivered", "delivered", NOW).kind,
    ).toBe("noop");
  });

  it("conflict before invalid when expectedStatus differs and transition is invalid", () => {
    const o = order("pending");
    expect(applyTransition(o, "delivered", "accepted", NOW)).toEqual({
      kind: "conflict",
      order: o,
    });
  });

  it("invalid when expectedStatus matches but transition is not allowed", () => {
    expect(applyTransition(order("pending"), "ready", "pending", NOW)).toEqual({
      kind: "invalid",
    });
    expect(
      applyTransition(order("delivered"), "ready", "delivered", NOW),
    ).toEqual({
      kind: "invalid",
    });
  });

  it("applied updates status, updatedAt and statusHistory without mutating input", () => {
    const o = order("pending");
    const r = applyTransition(o, "accepted", "pending", NOW);
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied") return;
    expect(r.previousStatus).toBe("pending");
    expect(r.order.status).toBe("accepted");
    expect(r.order.updatedAt).toBe(NOW.toISOString());
    expect(r.order.statusHistory.at(-1)).toEqual({
      status: "accepted",
      at: NOW.toISOString(),
    });
    expect(r.order.statusHistory).toHaveLength(2);
    expect(o.status).toBe("pending");
    expect(o.statusHistory).toHaveLength(1);
  });

  it("applied on step back and on cancel", () => {
    expect(
      applyTransition(order("ready"), "preparing", "ready", NOW).kind,
    ).toBe("applied");
    expect(
      applyTransition(order("preparing"), "cancelled", "preparing", NOW).kind,
    ).toBe("applied");
  });
});

describe("applyClientCancel", () => {
  it("applies from pending", () => {
    const r = applyClientCancel(order("pending"), NOW);
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied") return;
    expect(r.order.status).toBe("cancelled");
    expect(r.order.updatedAt).toBe(NOW.toISOString());
    expect(r.order.statusHistory.at(-1)).toEqual({
      status: "cancelled",
      at: NOW.toISOString(),
    });
    expect(r.previousStatus).toBe("pending");
  });

  it("does not mutate the input order", () => {
    const o = order("pending");
    const snapshot = structuredClone(o);
    applyClientCancel(o, NOW);
    expect(o).toEqual(snapshot);
  });

  for (const status of ALL.filter((s) => s !== "pending")) {
    it(`invalid from ${status} and returns the current order`, () => {
      const o = order(status);
      expect(applyClientCancel(o, NOW)).toEqual({ kind: "invalid", order: o });
    });
  }
});
