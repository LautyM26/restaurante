// Carta mínima de pruebas con todos los casos límite del dominio.
import type { Category, Dish, Menu, Option, OptionGroup } from '../../src/domain/types'

/** Construye una opción disponible y sin adicional, salvo que se indique lo contrario. */
export function makeOption(id: string, overrides: Partial<Option> = {}): Option {
  return { id, name: { es: id }, priceDeltaCents: 0, available: true, ...overrides }
}

/** Construye un grupo de opciones. */
export function makeGroup(id: string, overrides: Partial<OptionGroup> = {}): OptionGroup {
  return { id, name: { es: id }, type: 'single', min: 0, max: 1, options: [], ...overrides }
}

/** Construye un plato disponible de $1.000,00 sin opciones, salvo que se indique lo contrario. */
export function makeDish(id: string, overrides: Partial<Dish> = {}): Dish {
  return {
    id,
    categoryId: 'mains',
    order: 1,
    name: { es: id },
    description: { es: `Descripción de ${id}` },
    priceCents: 100000,
    tags: [],
    available: true,
    featured: false,
    optionGroups: [],
    ...overrides,
  }
}

/** Punto de cocción obligatorio (único, mín. 1): "bien cocido" no está disponible. */
export const cookingGroup = makeGroup('cooking', {
  type: 'single',
  min: 1,
  max: 1,
  options: [
    makeOption('rare'),
    makeOption('medium'),
    makeOption('well_done', { available: false }),
  ],
})

/** Extras opcionales (múltiple, máx. 2): uno gratis y dos con adicional. */
export const extrasGroup = makeGroup('extras', {
  type: 'multiple',
  min: 0,
  max: 2,
  options: [
    makeOption('ketchup'),
    makeOption('cheese', { priceDeltaCents: 50000 }),
    makeOption('bacon', { priceDeltaCents: 80000 }),
  ],
})

/** Plato con un grupo obligatorio y extras: $12.000,00 base. */
export const burger = makeDish('burger', {
  priceCents: 1200000,
  optionGroups: [cookingGroup, extrasGroup],
})

/** Plato simple: $5.000,00. */
export const salad = makeDish('salad', { categoryId: 'starters', priceCents: 500000 })

/** Plato marcado como no disponible. */
export const soldOut = makeDish('sold_out', { order: 3, available: false })

/** Plato disponible, pero con un grupo obligatorio sin opciones disponibles suficientes (P4). */
export const trapped = makeDish('trapped', {
  order: 4,
  optionGroups: [
    makeGroup('sauce', {
      min: 1,
      max: 1,
      options: [makeOption('bbq', { available: false }), makeOption('mayo', { available: false })],
    }),
  ],
})

/** Plato cuya categoría no existe (CL36). */
export const orphan = makeDish('orphan', { categoryId: 'ghost' })

export const starters: Category = { id: 'starters', name: { es: 'Entradas' }, order: 1, visual: 'starter' }
export const mains: Category = { id: 'mains', name: { es: 'Principales' }, order: 2, visual: 'main' }
export const emptyCategory: Category = { id: 'empty', name: { es: 'Postres' }, order: 3, visual: 'dessert' }

/**
 * Carta con el orden deliberadamente desordenado, una categoría vacía y un plato huérfano:
 * sirve para probar el ordenamiento y la depuración, y como carta vigente en otros tests.
 */
export const menu: Menu = {
  categories: [emptyCategory, mains, starters],
  dishes: [
    makeDish('b_second', { order: 2 }),
    orphan,
    burger,
    soldOut,
    trapped,
    salad,
    makeDish('a_first', { order: 0 }),
  ],
}
