// Cálculo de importes en centavos (RF18, RF44). Siempre con los precios de la carta vigente.
import type { CartLine, Dish, Menu, Selection } from './types'

/** Precio de una unidad: base más los adicionales de las opciones elegidas. */
export function unitPriceCents(dish: Dish, selection: Selection): number {
  let total = dish.priceCents
  for (const group of dish.optionGroups) {
    for (const optionId of selection[group.id] ?? []) {
      total += group.options.find((o) => o.id === optionId)?.priceDeltaCents ?? 0
    }
  }
  return total
}

/** Importe de una línea: (base + adicionales) × cantidad. */
export function lineTotalCents(dish: Dish, selection: Selection, quantity: number): number {
  return unitPriceCents(dish, selection) * quantity
}

/** Total del pedido en curso. Una línea de un plato que ya no está en la carta no suma. */
export function cartTotalCents(lines: CartLine[], menu: Menu): number {
  return lines.reduce((total, line) => {
    const dish = menu.dishes.find((d) => d.id === line.dishId)
    return dish ? total + lineTotalCents(dish, line.selection, line.quantity) : total
  }, 0)
}
