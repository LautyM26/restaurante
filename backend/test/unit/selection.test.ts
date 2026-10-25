import { describe, expect, it } from "vitest";
import {
  canonicalSelection,
  isDishOrderable,
  validateLine,
} from "@/domain/selection";
import type { Dish, Option, OptionGroup } from "@/domain/types";

const name = { es: "x" };
const opt = (id: string, available = true): Option => ({
  id,
  name,
  priceDeltaCents: 0,
  available,
});
const group = (id: string, over: Partial<OptionGroup> = {}): OptionGroup => ({
  id,
  name,
  type: "single",
  min: 0,
  max: 1,
  options: [],
  ...over,
});
const dish = (over: Partial<Dish> = {}): Dish => ({
  id: "d",
  categoryId: "c",
  order: 1,
  name,
  description: name,
  priceCents: 100,
  tags: [],
  available: true,
  featured: false,
  optionGroups: [],
  ...over,
});

const burger = dish({
  optionGroups: [
    group("cooking", {
      min: 1,
      options: [opt("rare"), opt("medium"), opt("well_done", false)],
    }),
    group("extras", {
      type: "multiple",
      min: 0,
      max: 2,
      options: [opt("cheese"), opt("bacon"), opt("ketchup")],
    }),
  ],
});
const line = (selection: Record<string, string[]>) => ({ selection });

describe("canonicalSelection", () => {
  it("ordena grupos y opciones y descarta grupos vacíos", () => {
    expect(canonicalSelection({ b: ["z", "a"], a: ["y"], c: [] })).toEqual([
      ["a", ["y"]],
      ["b", ["a", "z"]],
    ]);
  });
  it("no muta la entrada", () => {
    const s = { a: ["z", "a"] };
    canonicalSelection(s);
    expect(s).toEqual({ a: ["z", "a"] });
  });
});

describe("isDishOrderable", () => {
  it("pedible, agotado y grupo obligatorio sin opciones", () => {
    expect(isDishOrderable(burger)).toBe(true);
    expect(isDishOrderable(dish({ available: false }))).toBe(false);
    expect(
      isDishOrderable(
        dish({
          optionGroups: [group("g", { min: 1, options: [opt("a", false)] })],
        }),
      ),
    ).toBe(false);
  });
  it("mínimo 2 con 1 disponible falla; mínimo 1 alcanza; opcional vacío no impide", () => {
    const g = (min: number) =>
      dish({
        optionGroups: [
          group("g", {
            type: "multiple",
            min,
            max: 3,
            options: [opt("a"), opt("b", false)],
          }),
        ],
      });
    expect(isDishOrderable(g(2))).toBe(false);
    expect(isDishOrderable(g(1))).toBe(true);
    expect(
      isDishOrderable(
        dish({ optionGroups: [group("g", { options: [opt("a", false)] })] }),
      ),
    ).toBe(true);
  });
});

describe("validateLine", () => {
  it("línea válida sin problemas", () => {
    expect(
      validateLine(burger, line({ cooking: ["rare"], extras: ["cheese"] })),
    ).toEqual([]);
  });
  it("dish_not_found", () => {
    expect(validateLine(null, line({}))).toEqual([
      { reason: "dish_not_found" },
    ]);
  });
  it("dish_unavailable es el único motivo (agotado)", () => {
    expect(
      validateLine(dish({ available: false }), line({ x: ["y"] })),
    ).toEqual([{ reason: "dish_unavailable" }]);
  });
  it("dish_unavailable es el único motivo (grupo obligatorio sin opciones disponibles)", () => {
    const trapped = dish({
      optionGroups: [group("g", { min: 1, options: [opt("a", false)] })],
    });
    expect(validateLine(trapped, line({ g: ["a"], zz: ["q"] }))).toEqual([
      { reason: "dish_unavailable" },
    ]);
  });
  it("option_not_found: opción inexistente y de otro grupo", () => {
    expect(
      validateLine(burger, line({ cooking: ["rare"], extras: ["guacamole"] })),
    ).toEqual([
      { reason: "option_not_found", groupId: "extras", optionId: "guacamole" },
    ]);
    expect(validateLine(burger, line({ cooking: ["cheese"] }))).toEqual([
      { reason: "option_not_found", groupId: "cooking", optionId: "cheese" },
    ]);
  });
  it("option_unavailable", () => {
    expect(validateLine(burger, line({ cooking: ["well_done"] }))).toEqual([
      {
        reason: "option_unavailable",
        groupId: "cooking",
        optionId: "well_done",
      },
    ]);
  });
  it("selection_invalid: grupo ajeno al plato con groupId", () => {
    expect(
      validateLine(burger, line({ cooking: ["rare"], sauce: ["bbq"] })),
    ).toEqual([{ reason: "selection_invalid", groupId: "sauce" }]);
  });
  it("selection_invalid: opciones repetidas con groupId", () => {
    expect(
      validateLine(
        burger,
        line({ cooking: ["rare"], extras: ["cheese", "cheese"] }),
      ),
    ).toEqual([{ reason: "selection_invalid", groupId: "extras" }]);
  });
  it("grupo ajeno con varias opciones da un único issue (D-202)", () => {
    expect(
      validateLine(burger, line({ cooking: ["rare"], sauce: ["bbq", "mayo"] })),
    ).toEqual([{ reason: "selection_invalid", groupId: "sauce" }]);
  });
  it("repetida que además excede el máximo: dos issues del mismo grupo (D-203)", () => {
    expect(validateLine(burger, line({ cooking: ["rare", "rare"] }))).toEqual([
      { reason: "selection_invalid", groupId: "cooking" },
      { reason: "selection_invalid", groupId: "cooking" },
    ]);
  });
  it("opción inexistente repetida: un issue por aparición (D-203)", () => {
    expect(
      validateLine(
        burger,
        line({ cooking: ["rare"], extras: ["guacamole", "guacamole"] }),
      ),
    ).toEqual([
      { reason: "option_not_found", groupId: "extras", optionId: "guacamole" },
      { reason: "option_not_found", groupId: "extras", optionId: "guacamole" },
      { reason: "selection_invalid", groupId: "extras" },
    ]);
  });
  it("selection_invalid: debajo del mínimo y encima del máximo", () => {
    expect(validateLine(burger, line({}))).toEqual([
      { reason: "selection_invalid", groupId: "cooking" },
    ]);
    expect(
      validateLine(
        burger,
        line({ cooking: ["rare"], extras: ["cheese", "bacon", "ketchup"] }),
      ),
    ).toEqual([{ reason: "selection_invalid", groupId: "extras" }]);
  });
  it("array vacío equivale a no elegir nada", () => {
    expect(
      validateLine(burger, line({ cooking: ["rare"], extras: [] })),
    ).toEqual([]);
    expect(validateLine(burger, line({ cooking: [] }))).toEqual([
      { reason: "selection_invalid", groupId: "cooking" },
    ]);
    expect(
      validateLine(burger, line({ cooking: ["rare"], sauce: [] })),
    ).toEqual([]);
  });
  it("informa todos los problemas a la vez", () => {
    expect(
      validateLine(
        burger,
        line({ extras: ["guacamole", "cheese"], sauce: ["bbq"] }),
      ),
    ).toEqual([
      { reason: "option_not_found", groupId: "extras", optionId: "guacamole" },
      { reason: "selection_invalid", groupId: "sauce" },
      { reason: "selection_invalid", groupId: "cooking" },
    ]);
  });
});
