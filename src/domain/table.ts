// Lectura del número de mesa desde la URL del QR (RF1, RF2, CL1).

export type TableParam =
  | { kind: 'valid'; tableId: number }
  | { kind: 'missing' }
  | { kind: 'invalid'; raw: string }

/**
 * Interpreta `?mesa=` de la URL. Si el parámetro se repite vale el primero.
 * Vacío o ausente → missing. Solo 1 a 3 dígitos con valor 1..999 → valid ("012" = 12).
 * Cualquier otra cosa (letras, 0, negativos, decimales, espacios, 1000) → invalid.
 */
export function parseTableParam(search: string): TableParam {
  const raw = new URLSearchParams(search).get('mesa')
  if (raw === null || raw === '') return { kind: 'missing' }
  if (!/^\d{1,3}$/.test(raw)) return { kind: 'invalid', raw }
  const tableId = Number(raw)
  return tableId >= 1 ? { kind: 'valid', tableId } : { kind: 'invalid', raw }
}
