import type {
  CreateOrderInput,
  Dish,
  LineIssue,
  Selection,
} from "@/domain/types";

type OrderLine = Pick<CreateOrderInput["items"][number], "selection">;

/**
 * Forma canónica de una selección (igual que el front): grupos ordenados por id,
 * opciones ordenadas y sin grupos vacíos.
 */
export function canonicalSelection(selection: Selection): [string, string[]][] {
  return Object.entries(selection)
    .filter(([, optionIds]) => optionIds.length > 0)
    .map(([groupId, optionIds]): [string, string[]] => [
      groupId,
      [...optionIds].sort(),
    ])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Pedible (igual que el front): disponible y cada grupo con suficientes
 * opciones disponibles para alcanzar su mínimo.
 */
export function isDishOrderable(dish: Dish): boolean {
  return (
    dish.available &&
    dish.optionGroups.every(
      (g) => g.options.filter((o) => o.available).length >= g.min,
    )
  );
}

/** Problemas de una línea frente al plato vigente (diseno.md §8.4, D-084, D-116). */
export function validateLine(dish: Dish | null, line: OrderLine): LineIssue[] {
  if (!dish) return [{ reason: "dish_not_found" }];
  if (!isDishOrderable(dish)) return [{ reason: "dish_unavailable" }];

  const issues: LineIssue[] = [];
  for (const [groupId, optionIds] of Object.entries(line.selection)) {
    if (optionIds.length === 0) continue;
    const group = dish.optionGroups.find((g) => g.id === groupId);
    if (!group) {
      issues.push({ reason: "selection_invalid", groupId });
      continue;
    }
    for (const optionId of optionIds) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option)
        issues.push({ reason: "option_not_found", groupId, optionId });
      else if (!option.available)
        issues.push({ reason: "option_unavailable", groupId, optionId });
    }
    if (new Set(optionIds).size !== optionIds.length)
      issues.push({ reason: "selection_invalid", groupId });
  }
  for (const group of dish.optionGroups) {
    const count = (line.selection[group.id] ?? []).length;
    if (count < group.min || count > group.max)
      issues.push({ reason: "selection_invalid", groupId: group.id });
  }
  return issues;
}
