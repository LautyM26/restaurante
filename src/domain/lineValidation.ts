// Validación de una línea del pedido en curso frente a la carta vigente (RF44, CL15, CL27).
import { isDishOrderable, validateSelection } from './selection'
import type { CartLine, LineIssue, Menu } from './types'

/** Motivos por los que la línea ya no es válida; vacío si se puede enviar. */
export function validateLine(menu: Menu, line: CartLine): LineIssue[] {
  const dish = menu.dishes.find((d) => d.id === line.dishId)
  if (!dish) return [{ reason: 'dish_not_found' }]
  if (!isDishOrderable(dish)) return [{ reason: 'dish_unavailable' }]

  const issues: LineIssue[] = []
  for (const [groupId, optionIds] of Object.entries(line.selection)) {
    const group = dish.optionGroups.find((g) => g.id === groupId)
    for (const optionId of optionIds) {
      const option = group?.options.find((o) => o.id === optionId)
      if (!option) issues.push({ reason: 'option_not_found', groupId, optionId })
      else if (!option.available) issues.push({ reason: 'option_unavailable', groupId, optionId })
    }
  }
  for (const error of validateSelection(dish, line.selection)) {
    issues.push({ reason: 'selection_invalid', groupId: error.groupId })
  }
  return issues
}
