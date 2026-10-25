import type { Dish, Selection } from "@/domain/types";

/**
 * Importes en centavos con aritmética entera en `number` (D-053, D-076): el máximo
 * posible, 50 líneas × 20 unidades × 2^31, entra en 2^53. Las selecciones llegan ya
 * validadas (§8.4); una opción desconocida suma 0, igual que el front.
 */

/** Precio de una unidad: base más los adicionales de las opciones elegidas. */
export function unitPriceCents(dish: Dish, selection: Selection): number {
  let total = dish.priceCents;
  for (const group of dish.optionGroups) {
    for (const optionId of selection[group.id] ?? []) {
      total +=
        group.options.find((o) => o.id === optionId)?.priceDeltaCents ?? 0;
    }
  }
  return total;
}

/** Importe de una línea: (base + adicionales) × cantidad. */
export function lineTotalCents(
  dish: Dish,
  selection: Selection,
  quantity: number,
): number {
  return unitPriceCents(dish, selection) * quantity;
}

export interface PricedLine {
  dish: Dish;
  selection: Selection;
  quantity: number;
}

/** Total del pedido: suma de los importes de sus líneas. */
export function orderTotalCents(lines: readonly PricedLine[]): number {
  return lines.reduce(
    (total, l) => total + lineTotalCents(l.dish, l.selection, l.quantity),
    0,
  );
}
