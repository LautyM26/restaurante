// Orden y depuración de la carta antes de mostrarla (RF7, CL4, CL36).
import type { Menu } from './types'

/**
 * Devuelve la carta con categorías y platos por `order`, sin platos de categorías inexistentes
 * y sin categorías vacías. No modifica la carta recibida.
 */
export function sortMenu(menu: Menu): Menu {
  const categoryIds = new Set(menu.categories.map((c) => c.id))
  const dishes = menu.dishes.filter((d) => categoryIds.has(d.categoryId)).sort((a, b) => a.order - b.order)
  const usedIds = new Set(dishes.map((d) => d.categoryId))
  const categories = menu.categories.filter((c) => usedIds.has(c.id)).sort((a, b) => a.order - b.order)
  return { categories, dishes }
}
