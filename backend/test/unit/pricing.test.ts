import { describe, expect, it } from "vitest";
import {
  lineTotalCents,
  orderTotalCents,
  unitPriceCents,
} from "@/domain/pricing";
import type { Dish } from "@/domain/types";

function makeDish(priceCents: number): Dish {
  return {
    id: "d1",
    categoryId: "c1",
    order: 0,
    name: { es: "Plato" },
    description: { es: "" },
    priceCents,
    tags: [],
    available: true,
    featured: false,
    optionGroups: [
      {
        id: "g1",
        name: { es: "Extras" },
        type: "multiple",
        min: 0,
        max: 3,
        options: [
          {
            id: "o1",
            name: { es: "A" },
            priceDeltaCents: 150,
            available: true,
          },
          {
            id: "o2",
            name: { es: "B" },
            priceDeltaCents: 300,
            available: true,
          },
        ],
      },
    ],
  };
}

describe("pricing", () => {
  it("base sin opciones", () => {
    expect(unitPriceCents(makeDish(1000), {})).toBe(1000);
  });

  it("base más adicionales", () => {
    expect(unitPriceCents(makeDish(1000), { g1: ["o1", "o2"] })).toBe(1450);
  });

  it("línea = unitario × cantidad", () => {
    expect(lineTotalCents(makeDish(1000), { g1: ["o1"] }, 3)).toBe(3450);
  });

  it("total de varias líneas", () => {
    const dish = makeDish(1000);
    expect(
      orderTotalCents([
        { dish, selection: {}, quantity: 2 },
        { dish, selection: { g1: ["o2"] }, quantity: 1 },
      ]),
    ).toBe(3300);
  });

  it("caso máximo exacto: 50 líneas × 20 × 2^31", () => {
    const dish = makeDish(2 ** 31);
    const total = orderTotalCents(
      Array.from({ length: 50 }, () => ({ dish, selection: {}, quantity: 20 })),
    );
    expect(total).toBe(50 * 20 * 2 ** 31);
    expect(Number.isSafeInteger(total)).toBe(true);
  });
});
