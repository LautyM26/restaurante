// Reglas de selección de opciones de un plato (RF13, RF15-RF17).
import type { Dish, GroupError, OptionGroup, Selection } from './types'

/**
 * Forma canónica de una selección: grupos ordenados por id, opciones ordenadas y sin grupos vacíos.
 * Sirve para comparar configuraciones sin depender del orden en que se eligieron.
 */
export function canonicalSelection(selection: Selection): [string, string[]][] {
  return Object.entries(selection)
    .filter(([, optionIds]) => optionIds.length > 0)
    .map(([groupId, optionIds]): [string, string[]] => [groupId, [...optionIds].sort()])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Devuelve la selección que resulta de tocar una opción de un grupo.
 * Único: reemplaza la elegida. Múltiple: agrega o quita, sin superar el máximo.
 * Una opción inexistente o no disponible se rechaza (devuelve la misma selección),
 * salvo para quitar una ya elegida que dejó de estar disponible.
 */
export function toggleOption(group: OptionGroup, selection: Selection, optionId: string): Selection {
  const option = group.options.find((o) => o.id === optionId)
  const current = selection[group.id] ?? []
  const isSelected = current.includes(optionId)
  if (!option || (!option.available && !isSelected)) return selection

  let next: string[]
  if (group.type === 'single') next = [optionId]
  else if (isSelected) next = current.filter((id) => id !== optionId)
  else if (current.length >= group.max) return selection
  else next = [...current, optionId]

  const result = { ...selection, [group.id]: next }
  if (next.length === 0) delete result[group.id]
  return result
}

/** Errores de la selección frente a los mínimos y máximos de cada grupo del plato. */
export function validateSelection(dish: Dish, selection: Selection): GroupError[] {
  const errors: GroupError[] = []
  for (const group of dish.optionGroups) {
    const count = (selection[group.id] ?? []).length
    if (count < group.min) errors.push({ groupId: group.id, kind: 'min', missing: group.min - count })
    else if (count > group.max) errors.push({ groupId: group.id, kind: 'max', excess: count - group.max })
  }
  return errors
}

/**
 * Un plato se puede pedir si está disponible y cada grupo tiene suficientes opciones
 * disponibles para alcanzar su mínimo; si no, se muestra "Agotado" (RF13, P4).
 */
export function isDishOrderable(dish: Dish): boolean {
  return dish.available && dish.optionGroups.every((g) => g.options.filter((o) => o.available).length >= g.min)
}
