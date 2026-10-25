import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../../src/domain/fingerprint.js";
import type { CreateOrderInput } from "../../src/domain/types.js";

type Content = Omit<CreateOrderInput, "clientRequestId">;

function base(): Content {
  return {
    tableId: 5,
    note: "sin sal",
    expectedTotalCents: 3000,
    items: [
      {
        lineId: "a",
        dishId: "d1",
        quantity: 2,
        selection: { g1: ["o1", "o2"], g2: ["o3"] },
        note: "bien cocido",
      },
      { lineId: "b", dishId: "d2", quantity: 1, selection: {} },
    ],
  };
}

describe("computeFingerprint", () => {
  const ref = computeFingerprint(base());

  it("devuelve 64 caracteres hexadecimales", () => {
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es igual con las líneas en otro orden", () => {
    const c = base();
    c.items.reverse();
    expect(computeFingerprint(c)).toBe(ref);
  });

  it("es igual con opciones y grupos en otro orden", () => {
    const c = base();
    c.items[0]!.selection = { g2: ["o3"], g1: ["o2", "o1"] };
    expect(computeFingerprint(c)).toBe(ref);
  });

  it("es igual con notas que difieren solo en espacios", () => {
    const c = base();
    c.note = "  sin sal \n";
    c.items[0]!.note = "\tbien cocido  ";
    expect(computeFingerprint(c)).toBe(ref);
  });

  it("trata nota vacía, de espacios y ausente como lo mismo", () => {
    const a = base();
    delete a.note;
    const b = base();
    b.note = "   ";
    const c = base();
    c.note = "";
    expect(computeFingerprint(b)).toBe(computeFingerprint(a));
    expect(computeFingerprint(c)).toBe(computeFingerprint(a));
    const d = base();
    d.items[1]!.note = "";
    expect(computeFingerprint(d)).toBe(ref);
  });

  it("ignora grupos con selección vacía", () => {
    const c = base();
    c.items[1]!.selection = { g9: [] };
    expect(computeFingerprint(c)).toBe(ref);
  });

  it("cambia si cambia la mesa", () => {
    expect(computeFingerprint({ ...base(), tableId: 6 })).not.toBe(ref);
  });

  it("cambia si cambia la cantidad", () => {
    const c = base();
    c.items[0]!.quantity = 3;
    expect(computeFingerprint(c)).not.toBe(ref);
  });

  it("cambia si cambia la selección", () => {
    const c = base();
    c.items[0]!.selection = { g1: ["o1"], g2: ["o3"] };
    expect(computeFingerprint(c)).not.toBe(ref);
  });

  it("cambia si cambia la nota del pedido o de una línea", () => {
    expect(computeFingerprint({ ...base(), note: "con sal" })).not.toBe(ref);
    const c = base();
    c.items[0]!.note = "poco cocido";
    expect(computeFingerprint(c)).not.toBe(ref);
  });

  it("cambia si cambia expectedTotalCents", () => {
    expect(
      computeFingerprint({ ...base(), expectedTotalCents: 3100 }),
    ).not.toBe(ref);
  });

  it("no depende de clientRequestId", () => {
    const withId = (id: string): CreateOrderInput => ({
      ...base(),
      clientRequestId: id,
    });
    expect(computeFingerprint(withId("id-1"))).toBe(
      computeFingerprint(withId("id-2")),
    );
    expect(computeFingerprint(withId("id-1"))).toBe(ref);
  });
});
