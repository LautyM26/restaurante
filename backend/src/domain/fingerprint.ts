import { createHash } from "node:crypto";
import { canonicalSelection } from "@/domain/selection";
import { normalizeNote } from "@/domain/text";
import type { CreateOrderInput } from "@/domain/types";

/** Orden de strings por unidades de código UTF-16, sin locale (determinista, igual que el front). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Huella del contenido de un pedido (diseno.md §8.7, D-081): SHA-256 hex del JSON
 * canónico. Igual con líneas u opciones en otro orden o notas que difieren solo en
 * espacios. No incluye `clientRequestId` (es la clave) ni el restaurante (la
 * unicidad ya es por restaurante).
 */
export function computeFingerprint(
  input: Omit<CreateOrderInput, "clientRequestId">,
): string {
  const items = [...input.items]
    .sort((a, b) => compareStrings(a.lineId, b.lineId))
    .map((item) => ({
      lineId: item.lineId,
      dishId: item.dishId,
      quantity: item.quantity,
      selection: canonicalSelection(item.selection),
      note: normalizeNote(item.note ?? "") ?? "",
    }));
  const canonical = JSON.stringify({
    tableId: input.tableId,
    note: normalizeNote(input.note ?? "") ?? "",
    expectedTotalCents: input.expectedTotalCents,
    items,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
